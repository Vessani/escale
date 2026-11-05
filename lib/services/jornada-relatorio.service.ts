import { prisma } from "@/lib/prisma"
import type { Prisma } from "@prisma/client"
import { colunaDateParaLocal, dataParaColunaDate, inicioDoDia } from "@/lib/utils/date-format"
import type { RegistroJornadaRelatorio } from "@/lib/parsers/jornada-relatorio-parser"
import { MAX_DIAS_CONSECUTIVOS } from "./alocacao.service"
import { registrarJornadaNoDia } from "./motorista.service"
import { recalcularAvisosInterjornada } from "./interjornada.service"
import { CODIGO_EXAMES, CODIGO_FERIAS, CODIGO_INTERNO, CODIGO_MANUTENCAO } from "./codigo-jornada"
import { calcularCodigoJornadaNoDia } from "./jornada.service"
import { registrarAuditoria, type Ator } from "./auditoria.service"
import type { AjusteJornada } from "@/lib/validation/ajuste-jornada"
import { CAMPO_CONTEXTO_AUDITORIA } from "@/lib/utils/diff-auditoria"

export type ResultadoImportacaoJornada = {
  atualizados: number
  naoEncontrados: number[]
  duplicados: number[]
  /** Dias de importações anteriores que este arquivo não tem mais (ex: linha excluída na conferência) e foram apagados. */
  diasRemovidos: number
}

/**
 * O que o arquivo cobre: o período (primeiro e último dia com jornada no
 * arquivo) e as matrículas que aparecem nele — inclusive as de linhas
 * excluídas na conferência. Um dia dentro do período, de uma dessas
 * matrículas, que veio de importação anterior e não está mais no lote é
 * apagado. Sem cobertura, vale o período e as matrículas do próprio lote.
 *
 * `parcial`: o arquivo não traz todos os motoristas da filial. A cobertura da
 * filial (relatorioJornadaAte) não avança — ela diz "quem não aparece até aqui
 * não trabalhou", o que só vale pra um relatório completo. Não dá pra deduzir
 * pelo arquivo: quem folgou o período inteiro também não aparece nele.
 */
export type CoberturaImportacaoJornada = {
  de: string
  ate: string
  matriculas: number[]
  parcial?: boolean
}

/** Códigos de status especial (Férias/Exames/Interno/Manutenção) que o import não deve sobrescrever — só edição manual muda isso. */
const CODIGOS_STATUS_ESPECIAL = new Set([CODIGO_FERIAS, CODIGO_EXAMES, CODIGO_INTERNO, CODIGO_MANUTENCAO])

function ehStatusEspecial(codigo: number) {
  return CODIGOS_STATUS_ESPECIAL.has(codigo)
}

/** Status de hoje a partir do último registro: Férias marcadas há dias ainda valem hoje, mesmo sem linha no dia. */
async function estaEmStatusEspecialHoje(tx: Prisma.TransactionClient, motoristaId: number) {
  const agora = new Date()
  const ultimo = await tx.registroJornada.findFirst({
    where: { motoristaId, data: { lte: diaColuna(agora) } },
    orderBy: { data: "desc" },
    select: { data: true, codigo: true },
  })
  return ultimo !== null && ehStatusEspecial(calcularCodigoJornadaNoDia(ultimo.codigo, agora, colunaDateParaLocal(ultimo.data)))
}

/** Dia do relatório no formato da coluna `RegistroJornada.data` — mesma conversão de registrarJornadaNoDia. */
function diaColuna(dia: string | Date) {
  return dataParaColunaDate(inicioDoDia(new Date(dia)))
}

/**
 * "Dias Sem Folga" vira o código de jornada do dia — capado em
 * MAX_DIAS_CONSECUTIVOS (6): o relatório conta dias corridos sem descanso e
 * pode passar de 6 (ex: 7 = trabalhou o 7º dia seguido), mas nosso código 7
 * significa Folga — gravar o valor bruto marcaria "Folga" pra quem está
 * trabalhando, o oposto do que o relatório diz.
 */
function calcularCodigoDoDiasSemFolga(diasSemFolga: number) {
  return Math.max(1, Math.min(diasSemFolga, MAX_DIAS_CONSECUTIVOS))
}

/** Entre as jornadas de um motorista no lote, a de `inicioJornada` mais recente — mesmo critério que já valia quando só existia uma linha por matrícula. */
function jornadaMaisRecente(registros: RegistroJornadaRelatorio[]): RegistroJornadaRelatorio {
  return registros.reduce((maisRecente, atual) =>
    new Date(atual.inicioJornada) > new Date(maisRecente.inicioJornada) ? atual : maisRecente,
  )
}

/**
 * Grava, pra cada motorista do relatório (busca por `seva` = matrícula), o
 * início do turno mais recente do lote em `jornadaRelatorioInicio`, e
 * usa "Dias Sem Folga" de CADA dia listado pra alimentar o histórico do
 * calendário (`RegistroJornada`) — o relatório traz vários turnos por
 * motorista, um por dia trabalhado, não só o mais recente. Essa é a fonte
 * principal do controle de dias trabalhados; o preenchimento manual no
 * calendário fica só pra emergência. Dia marcado à mão como
 * Férias/Exames/Interno/Manutenção (código 8-11) não é sobrescrito nem apagado — evita
 * tirar alguém de licença sozinho. Vale por dia (antes valia pro motorista
 * inteiro e o mês todo dele deixava de atualizar).
 *
 * Re-importar regrava os dias do arquivo e apaga, dentro do período do
 * arquivo, os dias de importação anterior que não estão mais nele (ver
 * CoberturaImportacaoJornada) — senão uma linha excluída na conferência
 * continuava valendo nos relatórios.
 *
 * Matrículas sem motorista correspondente, ou com mais de um (seva
 * duplicado), são reportadas uma única vez cada (não por linha) e não
 * derrubam o import inteiro.
 *
 * Busca todos os motoristas do lote numa única query (por matrícula) — evita
 * 1 findMany por linha do relatório. A gravação em si usa uma transação por
 * motorista (ver comentário mais abaixo): agrupar todo o lote numa transação
 * só estourava o timeout do Prisma em relatórios grandes.
 *
 * Sem RegistroAuditoria própria de propósito: é um import em lote (pode
 * tocar centenas de RegistroJornada de uma vez), não uma decisão pontual de
 * alguém — auditar linha a linha aqui não agregaria sinal, só ruído.
 */
export async function atualizarJornadaRelatorioDosMotoristas(
  filialId: number,
  registros: RegistroJornadaRelatorio[],
  cobertura?: CoberturaImportacaoJornada,
): Promise<ResultadoImportacaoJornada> {
  const matriculas = [...new Set([...registros.map((registro) => registro.matricula), ...(cobertura?.matriculas ?? [])])]
  if (matriculas.length === 0) {
    return { atualizados: 0, naoEncontrados: [], duplicados: [], diasRemovidos: 0 }
  }

  const diasDoLote = registros.map((registro) => diaColuna(registro.dia).getTime())
  const periodo = {
    de: cobertura ? diaColuna(cobertura.de) : new Date(Math.min(...diasDoLote)),
    ate: cobertura ? diaColuna(cobertura.ate) : new Date(Math.max(...diasDoLote)),
  }
  const motoristasEncontrados = await prisma.motorista.findMany({
    where: { seva: { in: matriculas }, filialId, deletadoEm: null },
    select: { id: true, seva: true, jornadaRelatorioInicio: true },
  })

  const motoristasPorMatricula = new Map<number, typeof motoristasEncontrados>()
  for (const motorista of motoristasEncontrados) {
    const lista = motoristasPorMatricula.get(motorista.seva) ?? []
    lista.push(motorista)
    motoristasPorMatricula.set(motorista.seva, lista)
  }

  const registrosPorMatricula = new Map<number, RegistroJornadaRelatorio[]>()
  for (const registro of registros) {
    const lista = registrosPorMatricula.get(registro.matricula) ?? []
    lista.push(registro)
    registrosPorMatricula.set(registro.matricula, lista)
  }

  const naoEncontrados: number[] = []
  const duplicados: number[] = []
  const paraAtualizar: Array<{
    registrosDoMotorista: RegistroJornadaRelatorio[]
    motorista: { id: number; jornadaRelatorioInicio: Date | null }
  }> = []

  for (const matricula of matriculas) {
    const encontrados = motoristasPorMatricula.get(matricula) ?? []

    if (encontrados.length === 0) {
      naoEncontrados.push(matricula)
      continue
    }

    if (encontrados.length > 1) {
      duplicados.push(matricula)
      continue
    }

    paraAtualizar.push({
      registrosDoMotorista: registrosPorMatricula.get(matricula) ?? [],
      motorista: encontrados[0],
    })
  }

  if (paraAtualizar.length === 0) {
    return { atualizados: 0, naoEncontrados, duplicados, diasRemovidos: 0 }
  }

  // Até que dia o relatório cobre — antes do recálculo dos avisos abaixo,
  // que já precisa disso (viagemDesmentidaPeloRelatorio). Só avança: importar
  // um relatório antigo depois não "encolhe" a cobertura.
  const coberturaDoLote = periodo.ate
  if (!cobertura?.parcial) {
    await prisma.filial.updateMany({
      where: {
        id: filialId,
        OR: [{ relatorioJornadaAte: null }, { relatorioJornadaAte: { lt: coberturaDoLote } }],
      },
      data: { relatorioJornadaAte: coberturaDoLote },
    })
  }

  // Uma transação por motorista, não uma só pro lote inteiro — o relatório
  // pode trazer dezenas de dias por motorista, e centenas de upserts
  // sequenciais numa única transação contra um banco remoto estouram o
  // timeout padrão do Prisma (5s) bem antes de terminar. Isolar por motorista
  // também limita o "prejuízo" de uma falha no meio do lote: quem já foi
  // processado continua salvo.
  let diasRemovidos = 0
  const hoje = diaColuna(new Date()).getTime()

  for (const { registrosDoMotorista, motorista } of paraAtualizar) {
    await prisma.$transaction(async (tx) => {
      if (registrosDoMotorista.length > 0) {
        // Só avança: importar um relatório antigo depois não troca o horário habitual pelo de antes.
        const inicioMaisRecente = new Date(jornadaMaisRecente(registrosDoMotorista).inicioJornada)
        if (!motorista.jornadaRelatorioInicio || inicioMaisRecente > motorista.jornadaRelatorioInicio) {
          await tx.motorista.update({ where: { id: motorista.id }, data: { jornadaRelatorioInicio: inicioMaisRecente } })
        }
      }

      const existentes = await tx.registroJornada.findMany({
        where: { motoristaId: motorista.id, data: { gte: periodo.de, lte: periodo.ate } },
        select: { id: true, data: true, codigo: true, inicioJornada: true },
      })
      // Férias/Exames/Interno marcados à mão naquele dia não são sobrescritos
      // nem apagados — só aquele dia, não o mês inteiro do motorista.
      const diasEspeciais = new Set(
        existentes.filter((registro) => ehStatusEspecial(registro.codigo)).map((registro) => registro.data.getTime()),
      )
      const diasDoMotorista = new Set(registrosDoMotorista.map((registro) => diaColuna(registro.dia).getTime()))

      // Dia que veio de importação anterior (tem horário) e não está mais no
      // arquivo — ex: a linha foi excluída na conferência. Lançamento manual
      // do calendário (sem horário) fica.
      const remover = existentes.filter(
        (registro) =>
          registro.inicioJornada !== null && !diasDoMotorista.has(registro.data.getTime()) && !ehStatusEspecial(registro.codigo),
      )
      if (remover.length > 0) {
        await tx.registroJornada.deleteMany({ where: { id: { in: remover.map((registro) => registro.id) } } })
        diasRemovidos += remover.length
      }

      // Interno é dia de trabalho: fica Interno no calendário, mas com os
      // horários do relatório — sem eles o descanso seguinte não seria medido.
      // Se a linha saiu do arquivo, os horários saem junto.
      const diasInterno = new Set(
        existentes.filter((registro) => registro.codigo === CODIGO_INTERNO).map((registro) => registro.data.getTime()),
      )
      const internosForaDoArquivo = existentes.filter(
        (registro) =>
          registro.codigo === CODIGO_INTERNO && registro.inicioJornada !== null && !diasDoMotorista.has(registro.data.getTime()),
      )
      if (internosForaDoArquivo.length > 0) {
        await tx.registroJornada.updateMany({
          where: { id: { in: internosForaDoArquivo.map((registro) => registro.id) } },
          data: { inicioJornada: null, fimJornada: null, diasSemFolga: null },
        })
      }

      // Hoje sem registro, mas o motorista está em status especial: também não mexe.
      const loteTemHoje = registrosDoMotorista.some((registro) => diaColuna(registro.dia).getTime() === hoje)
      const especialHoje = loteTemHoje && (await estaEmStatusEspecialHoje(tx, motorista.id))

      for (const registro of registrosDoMotorista) {
        const dia = diaColuna(registro.dia).getTime()
        const interno = diasInterno.has(dia)
        if (!interno && (diasEspeciais.has(dia) || (dia === hoje && especialHoje))) continue
        const codigo = interno ? CODIGO_INTERNO : calcularCodigoDoDiasSemFolga(registro.diasSemFolga)
        await registrarJornadaNoDia(tx, motorista.id, new Date(registro.dia), codigo, {
          inicioJornada: new Date(registro.inicioJornada),
          fimJornada: new Date(registro.fimJornada),
          diasSemFolga: registro.diasSemFolga,
        })
      }

      // O fim de jornada real acabou de mudar — o aviso de descanso das
      // próximas viagens dele pode ter aparecido ou sumido.
      await recalcularAvisosInterjornada(tx, filialId, [motorista.id])
    })
  }

  return { atualizados: paraAtualizar.length, naoEncontrados, duplicados, diasRemovidos }
}

/**
 * Linhas que alguém corrigiu na conferência antes de importar (horário,
 * dias sem folga, linha ignorada...). O import em si não é auditado linha a
 * linha (ver acima), mas um ajuste manual é uma decisão de alguém — vira um
 * registro "Jornada" no Histórico, com antes → depois legível.
 */
export async function registrarAjustesJornada(filialId: number, ajustes: AjusteJornada[], ator: Ator | null) {
  if (ajustes.length === 0) return
  await prisma.$transaction(async (tx) => {
    for (const ajuste of ajustes) {
      await registrarAuditoria(tx, {
        entidade: "RegistroJornada",
        // Matrícula + dia (o RegistroJornada ainda pode nem existir, ou ser de outra linha do relatório).
        entidadeId: `${ajuste.matricula}-${ajuste.dia.slice(0, 10)}`,
        acao: "ATUALIZACAO",
        antes: ajuste.antes,
        // O contexto não entra no diff — o Histórico mostra como subtítulo do registro.
        depois: { ...ajuste.depois, [CAMPO_CONTEXTO_AUDITORIA]: ajuste.contexto },
        ator,
        filialId,
      })
    }
  })
}
