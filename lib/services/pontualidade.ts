/**
 * Regra de pontualidade da saída, sem dependências — usada no Dashboard
 * (navegador) e no relatório de pontualidade (servidor), pra os dois
 * contarem atraso do mesmo jeito.
 */

/** Saída até 15 min depois do previsto conta como no horário. */
export const TOLERANCIA_SAIDA_MINUTOS = 15

/** Minutos entre o início previsto e a saída real (negativo = saiu antes). */
export function minutosDeAtraso(inicioPrevisto: Date | string, horarioRealSaida: Date | string): number {
  return Math.round((new Date(horarioRealSaida).getTime() - new Date(inicioPrevisto).getTime()) / 60_000)
}

export function saidaAtrasada(minutos: number): boolean {
  return minutos > TOLERANCIA_SAIDA_MINUTOS
}
