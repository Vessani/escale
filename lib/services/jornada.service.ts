import { colunaDateParaLocal, inicioDoDia } from "@/lib/utils/date-format"

const DIAS_NO_CICLO_JORNADA = 7

/** Duração padrão de cada código especial com prazo — ver calcularCodigoJornadaNoDia. */
const DIAS_EXAMES = 1
const DIAS_FERIAS = 30

export type StatusJornada = {
  texto: string
}

export function diferencaEmDias(dataA: Date, dataB: Date) {
  const inicioA = inicioDoDia(dataA).getTime()
  const inicioB = inicioDoDia(dataB).getTime()
  return Math.round((inicioA - inicioB) / 86_400_000)
}

/**
 * Código de jornada projetado pra um dia a partir de um código conhecido
 * (`codigoAtual`) numa data âncora (`hoje`). Férias (8) e Exames (9) têm
 * prazo — 30 e 1 dia respectivamente — e depois disso o motorista retoma o
 * ciclo normal de trabalho a partir do código 1, contando desde o fim do
 * prazo; sem isso, marcar alguém como Férias ou Exame preenchia o calendário
 * inteiro dali em diante com o mesmo código pra sempre. Interno (10) e
 * Manutenção (11) continuam sem prazo — precisam ser encerrados manualmente.
 */
export function calcularCodigoJornadaNoDia(codigoAtual: number, dia: Date, hoje: Date) {
  const deslocamento = diferencaEmDias(dia, hoje)

  const duracao = codigoAtual === 9 ? DIAS_EXAMES : codigoAtual === 8 ? DIAS_FERIAS : null
  if (duracao !== null) {
    if (deslocamento < duracao) {
      return codigoAtual
    }

    const diasDesdeRetorno = deslocamento - duracao
    const rotacao = ((diasDesdeRetorno % DIAS_NO_CICLO_JORNADA) + DIAS_NO_CICLO_JORNADA) % DIAS_NO_CICLO_JORNADA
    return rotacao + 1
  }

  if (codigoAtual === 10 || codigoAtual === 11) {
    return codigoAtual
  }

  if (codigoAtual < 1 || codigoAtual > DIAS_NO_CICLO_JORNADA) {
    return codigoAtual
  }

  const base = codigoAtual - 1
  const rotacao = ((base + deslocamento) % DIAS_NO_CICLO_JORNADA + DIAS_NO_CICLO_JORNADA) % DIAS_NO_CICLO_JORNADA
  return rotacao + 1
}

export type PontoRegistroJornada = {
  data: Date
  codigo: number
  /** Fim real daquele dia (import do Relatório de Jornada) — ausente/null em linhas de origem manual (edição do calendário, criação de motorista, reconciliação de folga). Ver `encontrarFimJornadaAnterior`. Opcional pra não obrigar todo consumidor de `PontoRegistroJornada` (ex: `projetarCodigoNoDia`, que nunca olha esse campo) a informá-lo. */
  fimJornada?: Date | string | null
}

type RegistroJornadaBruto = {
  data: Date | string
  codigo: number
  fimJornada?: Date | string | null
}

/**
 * Converte registros brutos de jornada (Date vindo direto do Prisma, ou
 * string já serializada pro cliente) para o formato usado por
 * `projetarCodigoNoDia`, aplicando `colunaDateParaLocal`: a coluna é
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

/**
 * Fim da última jornada real (com horário importado — ver RegistroJornada)
 * estritamente anterior ao instante informado, a partir de um histórico já
 * carregado em memória. Substitui o uso do agregado
 * `Motorista.jornadaRelatorioFim` como referência de descanso: esse campo só
 * guarda "o turno mais recente do último lote importado", sem nenhuma relação
 * com a viagem sendo avaliada — podia até ser POSTERIOR ao início da nova
 * viagem, gerando descanso negativo tratado como violação (ver
 * `calcularAvisoInterjornada`/`calcularProximoInicioDisponivel` em
 * alocacao.service.ts). Ignora registros sem `fimJornada` (edição manual do
 * calendário, criação de motorista e reconciliação de folga não têm horário
 * real). Cálculo sobre instantes (timestamps), não datas — imune a fuso.
 *
 * Ver também `buscarFimJornadaAnterior` (motorista.service.ts), a versão que
 * consulta direto o banco quando só se tem o id do motorista, sem o
 * histórico já carregado.
 */
export function encontrarFimJornadaAnterior(
  registros: Array<{ fimJornada?: Date | string | null }>,
  antesDe: Date,
): Date | null {
  let maisRecente: Date | null = null

  for (const registro of registros) {
    if (!registro.fimJornada) continue

    const fim = new Date(registro.fimJornada)
    if (fim >= antesDe) continue

    if (!maisRecente || fim > maisRecente) {
      maisRecente = fim
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
export function projetarCodigoNoDia(
  registros: PontoRegistroJornada[],
  dia: Date,
  hoje: Date,
  codigoFallback: number,
): number {
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

  return calcularCodigoJornadaNoDia(ancora.codigo, dia, ancora.data)
}

export function obterStatusJornada(diasTrabalhados: number): StatusJornada {
  if (diasTrabalhados >= 1 && diasTrabalhados <= 3) {
    return { texto: `${diasTrabalhados}º dia` }
  }

  if (diasTrabalhados >= 4 && diasTrabalhados <= 5) {
    return { texto: `${diasTrabalhados}º dia` }
  }

  if (diasTrabalhados === 6) {
    return { texto: "6º dia" }
  }

  if (diasTrabalhados === 7) {
    return { texto: "Folga" }
  }

  if (diasTrabalhados === 8) {
    return { texto: "Férias" }
  }

  if (diasTrabalhados === 9) {
    return { texto: "Exames" }
  }

  if (diasTrabalhados === 10) {
    return { texto: "Interno" }
  }

  if (diasTrabalhados === 11) {
    return { texto: "Manutenção" }
  }

  return { texto: String(diasTrabalhados) }
}
