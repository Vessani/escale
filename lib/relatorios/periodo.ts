import { fimDoDia, formatDateForDateInput, inicioDoDia, parseDataLocal } from "@/lib/utils/date-format"

/** Máximo de um período, pra ninguém puxar anos de dados de uma vez. */
export const DIAS_MAXIMOS_PERIODO = 92

const UM_DIA_MS = 24 * 60 * 60 * 1000

export type Periodo = { de: Date; ate: Date; deTexto: string; ateTexto: string }

/** Período padrão (sem ?de/?ate na URL), em dias contados a partir de hoje. */
export type PeriodoPadrao = { diasAntes: number; diasDepois: number } | "MES_ATUAL"

/** YYYY-MM-DD do dia em Brasília (inicioDoDia é meia-noite de Brasília = 03:00 UTC do mesmo dia). */
export function diaParaTexto(data: Date): string {
  return formatDateForDateInput(inicioDoDia(data))
}

function inicioDoMes(agora: Date): Date {
  const [ano, mes] = diaParaTexto(agora).split("-")
  return parseDataLocal(`${ano}-${mes}-01`)
}

/**
 * Período de um relatório a partir do ?de/?ate (YYYY-MM-DD). null = data
 * inválida, fim antes do início ou período longo demais.
 */
export function resolverPeriodo(
  deTexto: string | undefined,
  ateTexto: string | undefined,
  padrao: PeriodoPadrao,
  agora = new Date(),
): Periodo | null {
  try {
    const hoje = inicioDoDia(agora)
    const dePadrao = padrao === "MES_ATUAL" ? inicioDoMes(agora) : new Date(hoje.getTime() - padrao.diasAntes * UM_DIA_MS)
    const atePadrao = padrao === "MES_ATUAL" ? hoje : new Date(hoje.getTime() + padrao.diasDepois * UM_DIA_MS)
    const inicio = inicioDoDia(deTexto ? parseDataLocal(deTexto) : dePadrao)
    const fimDia = ateTexto ? parseDataLocal(ateTexto) : atePadrao
    const fim = fimDoDia(fimDia)

    if (fim < inicio || fim.getTime() - inicio.getTime() > DIAS_MAXIMOS_PERIODO * UM_DIA_MS) return null

    return { de: inicio, ate: fim, deTexto: diaParaTexto(inicio), ateTexto: diaParaTexto(fimDia) }
  } catch {
    return null
  }
}

/** Como resolverPeriodo, mas cai no padrão quando a URL traz algo inválido. */
export function periodoOuPadrao(deTexto: string | undefined, ateTexto: string | undefined, padrao: PeriodoPadrao, agora = new Date()): Periodo {
  return resolverPeriodo(deTexto, ateTexto, padrao, agora) ?? resolverPeriodo(undefined, undefined, padrao, agora)!
}

/** Quantos dias de calendário o período cobre (de 01 a 30 = 30). */
export function diasNoPeriodo(periodo: Pick<Periodo, "de" | "ate">): number {
  return Math.round((inicioDoDia(periodo.ate).getTime() - inicioDoDia(periodo.de).getTime()) / UM_DIA_MS) + 1
}
