import { prisma } from "@/lib/prisma"
import { dataParaColunaDate, inicioDoDia } from "@/lib/utils/date-format"
import type { RegistroJornadaRelatorio } from "@/lib/parsers/jornada-relatorio-parser"
import { MAX_DIAS_CONSECUTIVOS } from "./alocacao.service"
import { registrarJornadaNoDia } from "./motorista.service"
import { recalcularAvisosInterjornada } from "./interjornada.service"
import { registrarAuditoria, type Ator } from "./auditoria.service"
import type { AjusteJornada } from "@/lib/validation/ajuste-jornada"
import { CAMPO_CONTEXTO_AUDITORIA } from "@/lib/utils/diff-auditoria"

export type ResultadoImportacaoJornada = {
  atualizados: number
  naoEncontrados: number[]
  duplicados: number[]
}

/** Códigos de status especial (Férias/Exames/Interno) que o import não deve sobrescrever — só edição manual muda isso. */
const CODIGO_STATUS_ESPECIAL_MIN = 8
const CODIGO_STATUS_ESPECIAL_MAX = 10

function motoristaEmStatusEspecial(diasTrabalhados: number) {
  return diasTrabalhados >= CODIGO_STATUS_ESPECIAL_MIN && diasTrabalhados <= CODIGO_STATUS_ESPECIAL_MAX
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
 * turno mais recente do lote nos campos `jornadaRelatorioInicio/Fim/Dia`, e
 * usa "Dias Sem Folga" de CADA dia listado pra alimentar o histórico do
 * calendário (`RegistroJornada`) — o relatório traz vários turnos por
 * motorista, um por dia trabalhado, não só o mais recente. Essa é a fonte
 * principal do controle de dias trabalhados; o preenchimento manual no
 * calendário fica só pra emergência. Motoristas manualmente marcados como
 * Férias/Exames/Interno (código 8-10) não têm nenhum dia do lote sobrescrito
 * no calendário, só o registro de horário mais recente — evita tirar alguém
 * de licença sozinho.
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
): Promise<ResultadoImportacaoJornada> {
  if (registros.length === 0) {
    return { atualizados: 0, naoEncontrados: [], duplicados: [] }
  }

  const matriculas = [...new Set(registros.map((registro) => registro.matricula))]
  const motoristasEncontrados = await prisma.motorista.findMany({
    where: { seva: { in: matriculas }, filialId, deletadoEm: null },
    select: { id: true, seva: true, diasTrabalhados: true },
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
    motorista: { id: number; diasTrabalhados: number }
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
    return { atualizados: 0, naoEncontrados, duplicados }
  }

  // Até que dia o relatório cobre — antes do recálculo dos avisos abaixo,
  // que já precisa disso (viagemDesmentidaPeloRelatorio). Só avança: importar
  // um relatório antigo depois não "encolhe" a cobertura.
  const ultimoDiaDoLote = registros.reduce(
    (maisRecente, registro) => (new Date(registro.dia) > maisRecente ? new Date(registro.dia) : maisRecente),
    new Date(registros[0].dia),
  )
  const coberturaDoLote = dataParaColunaDate(inicioDoDia(ultimoDiaDoLote))
  await prisma.filial.updateMany({
    where: {
      id: filialId,
      OR: [{ relatorioJornadaAte: null }, { relatorioJornadaAte: { lt: coberturaDoLote } }],
    },
    data: { relatorioJornadaAte: coberturaDoLote },
  })

  // Uma transação por motorista, não uma só pro lote inteiro — o relatório
  // pode trazer dezenas de dias por motorista, e centenas de upserts
  // sequenciais numa única transação contra um banco remoto estouram o
  // timeout padrão do Prisma (5s) bem antes de terminar. Isolar por motorista
  // também limita o "prejuízo" de uma falha no meio do lote: quem já foi
  // processado continua salvo.
  for (const { registrosDoMotorista, motorista } of paraAtualizar) {
    await prisma.$transaction(async (tx) => {
      const registroMaisRecente = jornadaMaisRecente(registrosDoMotorista)

      await tx.motorista.update({
        where: { id: motorista.id },
        data: {
          jornadaRelatorioInicio: new Date(registroMaisRecente.inicioJornada),
          jornadaRelatorioFim: new Date(registroMaisRecente.fimJornada),
          jornadaRelatorioDia: new Date(registroMaisRecente.dia),
        },
      })

      if (!motoristaEmStatusEspecial(motorista.diasTrabalhados)) {
        for (const registro of registrosDoMotorista) {
          const codigo = calcularCodigoDoDiasSemFolga(registro.diasSemFolga)
          await registrarJornadaNoDia(tx, motorista.id, new Date(registro.dia), codigo, {
            inicioJornada: new Date(registro.inicioJornada),
            fimJornada: new Date(registro.fimJornada),
            diasSemFolga: registro.diasSemFolga,
          })
        }
      }

      // O fim de jornada real acabou de mudar — o aviso de descanso das
      // próximas viagens dele pode ter aparecido ou sumido.
      await recalcularAvisosInterjornada(tx, filialId, [motorista.id])
    })
  }

  return { atualizados: paraAtualizar.length, naoEncontrados, duplicados }
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
