import { colunaDateParaLocal, fimDoDia, inicioDoDia } from "@/lib/utils/date-format"
import {
  CODIGO_EXAMES,
  CODIGO_FERIAS,
  CODIGO_FOLGA,
  CODIGO_INTERNO,
  CODIGO_MANUTENCAO,
  ROTULO_CODIGO_PARADO,
  ehDiaDeTrabalho,
} from "./codigo-jornada"
import { MAX_DIAS_SEM_FOLGA } from "./dias-sem-folga"
import { HORA_INICIO_TURNO_DIA } from "./turno"

const DIAS_NO_CICLO_JORNADA = 7

/** Duração padrão de cada código especial com prazo — ver calcularCodigoJornadaNoDia. */
const DIAS_EXAMES = 1
const DIAS_INTERNO = 1
const DIAS_FERIAS = 30
const DURACAO_DO_CODIGO: Record<number, number> = {
  [CODIGO_FERIAS]: DIAS_FERIAS,
  [CODIGO_EXAMES]: DIAS_EXAMES,
  [CODIGO_INTERNO]: DIAS_INTERNO,
}

type StatusJornada = {
  texto: string
}

export function diferencaEmDias(dataA: Date, dataB: Date) {
  const inicioA = inicioDoDia(dataA).getTime()
  const inicioB = inicioDoDia(dataB).getTime()
  return Math.round((inicioA - inicioB) / 86_400_000)
}

/**
 * Código de jornada projetado pra um dia a partir de um código conhecido
 * (`codigoAtual`) numa data âncora (`hoje`). Férias (8), Exames (9) e
 * Interno (10) têm prazo — 30, 1 e 1 dia respectivamente — e depois disso o
 * motorista retoma o ciclo normal de trabalho a partir do código 1, contando
 * desde o fim do prazo; sem isso, marcar alguém como Férias, Exame ou Interno
 * preenchia o calendário inteiro dali em diante com o mesmo código pra
 * sempre. Só Manutenção (11) continua sem prazo — precisa ser encerrada
 * manualmente. Com histórico, o Interno não recomeça o ciclo: ele conta como
 * dia de trabalho (ver projetarCodigo). O retorno ao código 1 aqui só vale pra
 * quem não tem nenhum registro.
 */
export function calcularCodigoJornadaNoDia(codigoAtual: number, dia: Date, hoje: Date) {
  const deslocamento = diferencaEmDias(dia, hoje)

  const duracao = DURACAO_DO_CODIGO[codigoAtual] ?? null
  if (duracao !== null) {
    if (deslocamento < duracao) {
      return codigoAtual
    }

    const diasDesdeRetorno = deslocamento - duracao
    const rotacao = ((diasDesdeRetorno % DIAS_NO_CICLO_JORNADA) + DIAS_NO_CICLO_JORNADA) % DIAS_NO_CICLO_JORNADA
    return rotacao + 1
  }

  if (codigoAtual === CODIGO_MANUTENCAO) {
    return codigoAtual
  }

  if (codigoAtual < 1 || codigoAtual > DIAS_NO_CICLO_JORNADA) {
    return codigoAtual
  }

  const base = codigoAtual - 1
  const rotacao = (((base + deslocamento) % DIAS_NO_CICLO_JORNADA) + DIAS_NO_CICLO_JORNADA) % DIAS_NO_CICLO_JORNADA
  return rotacao + 1
}

export type PontoRegistroJornada = {
  data: Date
  codigo: number
  /** Fim real daquele dia (import do Relatório de Jornada) — ausente/null em linhas de origem manual (edição do calendário, criação de motorista, reconciliação de folga). Ver `encontrarJornadaAnterior`. Opcional pra não obrigar todo consumidor de `PontoRegistroJornada` a informá-lo. */
  fimJornada?: Date | string | null
  /** Folga deduzida do relatório, sem linha no banco — ver completarFolgasDoRelatorio. */
  inferido?: boolean
}

type RegistroJornadaBruto = {
  data: Date | string
  codigo: number
  fimJornada?: Date | string | null
}

/**
 * Converte registros brutos de jornada (Date vindo direto do Prisma, ou
 * string já serializada pro cliente) para o formato usado por
 * `situacaoDoDia`, aplicando `colunaDateParaLocal`: a coluna é
 * `@db.Date`, sempre devolvida em meia-noite UTC pelo Prisma, e comparar
 * isso direto com datas locais desloca um dia em fusos negativos.
 */
export function mapearRegistrosJornada(registros: RegistroJornadaBruto[]): PontoRegistroJornada[] {
  return registros.map((registro) => ({
    data: colunaDateParaLocal(new Date(registro.data)),
    codigo: registro.codigo,
    fimJornada: registro.fimJornada ?? null,
  }))
}

const UM_DIA_MS = 86_400_000

/**
 * O Relatório de Jornada traz todo dia trabalhado (quem pega veículo bate o
 * ponto). Então, dentro do que o relatório cobre, dia sem registro = o
 * motorista NÃO trabalhou = folga. Sem isso a projeção supunha que ele
 * seguiu trabalhando (4º → 5º → 6º → "7º = Folga") e um motorista
 * descansado aparecia fora da regra.
 *
 * Preenche com Folga os dias depois do último registro até a VÉSPERA do
 * fim da cobertura — o último dia do relatório pode estar incompleto (o
 * noturno que entra às 20h ainda não bateu o ponto quando o relatório é
 * exportado), então ali a ausência continua sendo "não sei" e vale a
 * projeção normal. Não mexe em quem está em Férias/Exames/Manutenção nem em
 * quem não tem histórico. Interno é dia de trabalho: depois dele vale a mesma regra.
 */
export function completarFolgasDoRelatorio(registros: PontoRegistroJornada[], relatorioJornadaAte: Date | null): PontoRegistroJornada[] {
  if (!relatorioJornadaAte || registros.length === 0) return registros
  const limite = inicioDoDia(relatorioJornadaAte).getTime() - UM_DIA_MS
  const dias = new Set(registros.map((registro) => inicioDoDia(registro.data).getTime()))

  let ancora: PontoRegistroJornada | null = null
  for (const registro of registros) {
    const dia = inicioDoDia(registro.data).getTime()
    if (dia <= limite && (!ancora || dia > inicioDoDia(ancora.data).getTime())) ancora = registro
  }
  if (!ancora || (ancora.codigo > CODIGO_FOLGA && ancora.codigo !== CODIGO_INTERNO)) return registros

  const folgas: PontoRegistroJornada[] = []
  for (let dia = inicioDoDia(ancora.data).getTime() + UM_DIA_MS; dia <= limite; dia += UM_DIA_MS) {
    // inicioDoDia de novo: dia + 24h pode cair às 23h/01h numa virada de horário de verão.
    const data = inicioDoDia(new Date(dia + UM_DIA_MS / 2))
    if (!dias.has(data.getTime())) folgas.push({ data, codigo: CODIGO_FOLGA, fimJornada: null, inferido: true })
  }
  return folgas.length ? [...registros, ...folgas] : registros
}

/**
 * O que a regra de descanso precisa da jornada de um motorista vindo do
 * banco: o histórico convertido (mapearRegistrosJornada) e até que dia o
 * Relatório de Jornada da filial cobre (`filial.relatorioJornadaAte`, ver
 * viagemDesmentidaPeloRelatorio). Espalhe o resultado sobre o motorista.
 */
export function prepararJornadaDoMotorista(motorista: {
  registrosJornada: RegistroJornadaBruto[]
  filial?: { relatorioJornadaAte: Date | string | null } | null
}): { registrosJornada: PontoRegistroJornada[]; relatorioJornadaAte: Date | null } {
  const cobertura = motorista.filial?.relatorioJornadaAte
  const relatorioJornadaAte = cobertura ? colunaDateParaLocal(new Date(cobertura)) : null
  return {
    registrosJornada: completarFolgasDoRelatorio(mapearRegistrosJornada(motorista.registrosJornada), relatorioJornadaAte),
    relatorioJornadaAte,
  }
}

/**
 * Última jornada real (com horário importado — ver RegistroJornada) que
 * terminou antes do instante informado: o dia dela e o fim. O dia vem junto
 * porque a jornada pode terminar de madrugada, já na data seguinte — ver
 * descansoMinimoNecessarioApos. Trabalha a partir de um histórico já
 * carregado em memória. Ignora registros sem `fimJornada` (edição manual do
 * calendário, criação de motorista e reconciliação de folga não têm horário
 * real). Cálculo sobre instantes (timestamps), não datas — imune a fuso.
 *
 * Só o lado do relatório: o trabalho anterior completo (relatório + viagens,
 * com finalização) é `encontrarTrabalhoAnterior` (alocacao/descanso.ts).
 */
export function encontrarJornadaAnterior(
  registros: Array<{ data: Date; fimJornada?: Date | string | null }>,
  antesDe: Date,
): { dia: Date; fim: Date } | null {
  let maisRecente: { dia: Date; fim: Date } | null = null

  for (const registro of registros) {
    if (!registro.fimJornada) continue

    const fim = new Date(registro.fimJornada)
    if (fim >= antesDe) continue

    if (!maisRecente || fim > maisRecente.fim) {
      maisRecente = { dia: registro.data, fim }
    }
  }

  return maisRecente
}

/**
 * Código de jornada projetado para um dia, ancorado no registro histórico
 * mais próximo (não sempre em "hoje"). Isso permite editar um dia específico
 * (ex: marcar amanhã como Folga) sem afetar o código de hoje ou de outros
 * dias — cada um projeta a partir do registro conhecido mais relevante.
 */
function projetarCodigo(jornada: JornadaDoMotorista, dia: Date, hoje: Date): number {
  const { registrosJornada: registros, diasTrabalhados: codigoFallback } = jornada
  const ordenados = [...registros].sort((a, b) => a.data.getTime() - b.data.getTime())
  const diaAlvo = inicioDoDia(dia).getTime()

  let ancora: PontoRegistroJornada | null = null

  for (const registro of ordenados) {
    if (inicioDoDia(registro.data).getTime() <= diaAlvo) {
      ancora = registro
    } else {
      break
    }
  }

  if (!ancora) {
    ancora = ordenados[0] ?? null
  }

  if (!ancora) {
    return calcularCodigoJornadaNoDia(codigoFallback, dia, hoje)
  }

  // Interno é dia de trabalho: o ciclo segue de onde estava, não recomeça.
  if (ancora.codigo === CODIGO_INTERNO && inicioDoDia(ancora.data).getTime() < inicioDoDia(dia).getTime()) {
    return calcularCodigoJornadaNoDia(codigoTrabalhandoNoDia(jornada, ancora.data, hoje), dia, ancora.data)
  }

  return calcularCodigoJornadaNoDia(ancora.codigo, dia, ancora.data)
}

/** De onde veio o código do dia, na ordem de prioridade de situacaoDoDia. */
type FonteDoDia = "MANUAL" | "RELATORIO" | "VIAGEM" | "PROJECAO"

type SituacaoDoDia = {
  codigo: number
  fonte: FonteDoDia
  /**
   * false = palpite: o dia é anterior a tudo que se sabe do motorista. De
   * "06/10 = 1º dia" a conta concluiria "05/10 = Folga", mesmo ele tendo
   * trabalhado no dia 05 (o histórico só não chegou ao Escalador). O `codigo`
   * ainda vem preenchido, mas nenhuma regra deve se apoiar nele.
   */
  conhecido: boolean
}

/** O que situacaoDoDia precisa do motorista: `registrosJornada` já preparado (ver prepararJornadaDoMotorista). */
export type JornadaDoMotorista = { registrosJornada: PontoRegistroJornada[]; diasTrabalhados: number }

function fonteDoRegistro(registro: PontoRegistroJornada): FonteDoDia {
  // Acima de Folga (Férias, Exames, Interno, Manutenção) o relatório não diz:
  // é sempre marcação de alguém, mesmo em dia com horário importado.
  if (registro.codigo > CODIGO_FOLGA) return "MANUAL"
  return registro.fimJornada || registro.inferido ? "RELATORIO" : "MANUAL"
}

/**
 * Código de quem trabalha num dia que seria de Folga. Só descansou de verdade
 * quem vinha de uma folga: aí recomeça no 1º dia. Vindo de um dia de trabalho
 * o ciclo continua — zerar esconderia o 7º dia seguido, por isso o teto de 6,
 * como no import do relatório (ver calcularCodigoDoDiasSemFolga).
 */
export function codigoTrabalhandoNoDia(jornada: JornadaDoMotorista, dia: Date, hoje: Date): number {
  const ontem = new Date(dia.getTime() - UM_DIA_MS)
  // Para aqui no dia desconhecido: é o que encerra a volta por Internos seguidos.
  if (!situacaoDoDia(jornada, ontem, hoje).conhecido) return 1

  const posicaoOntem = posicaoNoCiclo(jornada, ontem, hoje)
  return ehDiaDeTrabalho(posicaoOntem) ? Math.min(posicaoOntem + 1, MAX_DIAS_SEM_FOLGA) : 1
}

/**
 * Em que dia do ciclo o motorista está. É o próprio código, menos no Interno:
 * o calendário mostra "Interno", mas ele conta como dia de trabalho.
 */
export function posicaoNoCiclo(jornada: JornadaDoMotorista, dia: Date, hoje: Date): number {
  const { codigo } = situacaoDoDia(jornada, dia, hoje)
  return codigo === CODIGO_INTERNO ? codigoTrabalhandoNoDia(jornada, dia, hoje) : codigo
}

/**
 * Situação do motorista num dia: a fonte ÚNICA do código de jornada. Vale o
 * primeiro que existir, nesta ordem:
 * 1. marcação manual e relatório — o registro do próprio dia (são a mesma
 *    linha: o import regrava a linha, menos Férias/Exames/Interno marcados à
 *    mão, que ficam; dia sem linha que o relatório cobre vem de
 *    completarFolgasDoRelatorio);
 * 2. viagem — quem tem trabalho num dia projetado como Folga não está de
 *    folga. Só com `temViagem`, que quem mostra a agenda informa (calendário,
 *    ver viagemEhTrabalhoNoDia). A alocação NÃO passa isso de propósito: lá uma
 *    viagem manual num dia de Folga não pode liberar o motorista pra sugestão
 *    automática de outra viagem no mesmo dia;
 * 3. projeção — o ciclo a partir do registro conhecido mais próximo.
 */
export function situacaoDoDia(
  jornada: JornadaDoMotorista,
  dia: Date,
  hoje: Date,
  { temViagem = false }: { temViagem?: boolean } = {},
): SituacaoDoDia {
  const { registrosJornada: registros } = jornada
  const diaAlvo = inicioDoDia(dia).getTime()

  const doDia = registros.find((registro) => inicioDoDia(registro.data).getTime() === diaAlvo)
  if (doDia) return { codigo: doDia.codigo, fonte: fonteDoRegistro(doDia), conhecido: true }

  const conhecido =
    registros.length === 0
      ? diaAlvo >= inicioDoDia(hoje).getTime()
      : registros.some((registro) => inicioDoDia(registro.data).getTime() <= diaAlvo)
  const codigo = projetarCodigo(jornada, dia, hoje)

  if (!temViagem) return { codigo, fonte: "PROJECAO", conhecido }
  return { codigo: codigo === CODIGO_FOLGA ? codigoTrabalhandoNoDia(jornada, dia, hoje) : codigo, fonte: "VIAGEM", conhecido }
}

type ViagemNoDia = {
  inicioPrevisto: Date | string
  fimPrevisto: Date | string
  status: string
  finalizadoEm?: Date | string | null
}

/**
 * A viagem é trabalho do motorista no dia? Mesma regra de filtroAtividadeNoDia
 * (lib/queries/motoristas.ts), que faz isto no banco: começa no dia, ou vem de
 * antes e passa das 04:00 (chegar de madrugada ainda é o dia anterior);
 * finalizada vale pelo fim efetivo; cancelada nunca.
 */
export function viagemEhTrabalhoNoDia(viagem: ViagemNoDia, dia: Date): boolean {
  if (viagem.status === "CANCELADA") return false

  const inicio = new Date(viagem.inicioPrevisto)
  const inicioDia = inicioDoDia(dia)
  if (inicio > fimDoDia(dia)) return false
  if (inicio >= inicioDia) return true

  const inicioDaJornada = inicioDia.getTime() + HORA_INICIO_TURNO_DIA * 60 * 60 * 1000
  if (new Date(viagem.fimPrevisto).getTime() < inicioDaJornada) return false
  if (viagem.status !== "FINALIZADA") return true
  return Boolean(viagem.finalizadoEm) && new Date(viagem.finalizadoEm as Date | string).getTime() >= inicioDaJornada
}

export function obterStatusJornada(codigo: number): StatusJornada {
  if (ehDiaDeTrabalho(codigo)) return { texto: `${codigo}º dia` }
  return { texto: ROTULO_CODIGO_PARADO[codigo] ?? String(codigo) }
}
