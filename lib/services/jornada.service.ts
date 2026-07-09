import { inicioDoDia } from "@/lib/utils/date-format"

const DIAS_NO_CICLO_JORNADA = 7

export type StatusJornada = {
  texto: string
}

export function diferencaEmDias(dataA: Date, dataB: Date) {
  const inicioA = inicioDoDia(dataA).getTime()
  const inicioB = inicioDoDia(dataB).getTime()
  return Math.round((inicioA - inicioB) / 86_400_000)
}

export function calcularCodigoJornadaNoDia(codigoAtual: number, dia: Date, hoje: Date) {
  if (codigoAtual >= 8 && codigoAtual <= 10) {
    return codigoAtual
  }

  if (codigoAtual < 1 || codigoAtual > DIAS_NO_CICLO_JORNADA) {
    return codigoAtual
  }

  const deslocamento = diferencaEmDias(dia, hoje)
  const base = codigoAtual - 1
  const rotacao = ((base + deslocamento) % DIAS_NO_CICLO_JORNADA + DIAS_NO_CICLO_JORNADA) % DIAS_NO_CICLO_JORNADA
  return rotacao + 1
}

export type PontoRegistroJornada = {
  data: Date
  codigo: number
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

  return { texto: String(diasTrabalhados) }
}
