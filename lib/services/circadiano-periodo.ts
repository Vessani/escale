import { fimDoDia, formatDateForDateInput, inicioDoDia, parseDataLocal } from "@/lib/utils/date-format"

/** Sem filtro: os últimos 7 dias (o que já aconteceu) e os próximos 7 (o que está agendado). */
export const DIAS_PADRAO_CIRCADIANO = 7

/** Máximo de um período, pra ninguém puxar anos de jornada de uma vez. */
export const DIAS_MAXIMOS_CIRCADIANO = 92

const UM_DIA_MS = 24 * 60 * 60 * 1000

export type PeriodoCircadiano = { de: Date; ate: Date; deTexto: string; ateTexto: string }

/** YYYY-MM-DD do dia em Brasília (inicioDoDia é meia-noite de Brasília = 03:00 UTC do mesmo dia). */
function diaParaTexto(data: Date): string {
  return formatDateForDateInput(inicioDoDia(data))
}

/**
 * Período do relatório a partir do ?de/?ate (YYYY-MM-DD). null = data
 * inválida, fim antes do início ou período longo demais.
 */
export function periodoCircadiano(
  deTexto?: string,
  ateTexto?: string,
  agora = new Date(),
  padrao: { diasAntes: number; diasDepois: number } = { diasAntes: DIAS_PADRAO_CIRCADIANO, diasDepois: DIAS_PADRAO_CIRCADIANO },
): PeriodoCircadiano | null {
  try {
    const de = deTexto ? parseDataLocal(deTexto) : new Date(inicioDoDia(agora).getTime() - padrao.diasAntes * UM_DIA_MS)
    const ate = ateTexto ? parseDataLocal(ateTexto) : new Date(inicioDoDia(agora).getTime() + padrao.diasDepois * UM_DIA_MS)
    const inicio = inicioDoDia(de)
    const fim = fimDoDia(ate)

    if (fim < inicio || fim.getTime() - inicio.getTime() > DIAS_MAXIMOS_CIRCADIANO * UM_DIA_MS) return null

    return { de: inicio, ate: fim, deTexto: diaParaTexto(inicio), ateTexto: diaParaTexto(ate) }
  } catch {
    return null
  }
}

/** Dias sem folga: sem filtro, os últimos 30 dias até hoje. */
export function periodoSemFolga(deTexto?: string, ateTexto?: string, agora = new Date()) {
  return periodoCircadiano(deTexto, ateTexto, agora, { diasAntes: 30, diasDepois: 0 })
}
