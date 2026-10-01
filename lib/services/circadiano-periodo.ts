import { resolverPeriodo, type Periodo } from "@/lib/relatorios/periodo"

/** Sem filtro: os últimos 7 dias (o que já aconteceu) e os próximos 7 (o que está agendado). */
export const DIAS_PADRAO_CIRCADIANO = 7

export type PeriodoCircadiano = Periodo

export function periodoCircadiano(deTexto?: string, ateTexto?: string, agora = new Date()): Periodo | null {
  return resolverPeriodo(deTexto, ateTexto, { diasAntes: DIAS_PADRAO_CIRCADIANO, diasDepois: DIAS_PADRAO_CIRCADIANO }, agora)
}

/** Dias sem folga: sem filtro, os últimos 30 dias até hoje. */
export function periodoSemFolga(deTexto?: string, ateTexto?: string, agora = new Date()): Periodo | null {
  return resolverPeriodo(deTexto, ateTexto, { diasAntes: 30, diasDepois: 0 }, agora)
}
