/**
 * Mesmo estilo "sutil" (fundo bem claro + texto colorido) das variantes
 * semânticas do Badge (ver components/ui/badge.tsx) — aqui como classes
 * centralizadas porque o calendário de jornada tem mais gradações de cor
 * (a severidade de 1 a 6, depois os status especiais 7-10) do que as 3
 * variantes semânticas cobrem.
 */
export const CLASSE_JORNADA_1_3 = "bg-success/10 text-success border border-success/30"
export const CLASSE_JORNADA_4_5 = "bg-yellow-500/10 text-yellow-600 border border-yellow-500/30"
export const CLASSE_JORNADA_6 = "bg-warning/10 text-warning border border-warning/30"
export const CLASSE_JORNADA_FOLGA = "bg-sky-500/10 text-sky-600 border border-sky-500/30"
export const CLASSE_JORNADA_FERIAS = "bg-indigo-500/10 text-indigo-600 border border-indigo-500/30"
export const CLASSE_JORNADA_EXAMES = "bg-rose-500/10 text-rose-600 border border-rose-500/30"
export const CLASSE_JORNADA_INTERNO = "bg-muted text-muted-foreground border border-border"
export const CLASSE_JORNADA_PADRAO = "bg-muted text-muted-foreground border border-border"

export function classeBadgeJornada(diasTrabalhados: number): string {
  if (diasTrabalhados >= 1 && diasTrabalhados <= 3) {
    return CLASSE_JORNADA_1_3
  }

  if (diasTrabalhados >= 4 && diasTrabalhados <= 5) {
    return CLASSE_JORNADA_4_5
  }

  if (diasTrabalhados === 6) {
    return CLASSE_JORNADA_6
  }

  if (diasTrabalhados === 7) {
    return CLASSE_JORNADA_FOLGA
  }

  if (diasTrabalhados === 8) {
    return CLASSE_JORNADA_FERIAS
  }

  if (diasTrabalhados === 9) {
    return CLASSE_JORNADA_EXAMES
  }

  if (diasTrabalhados === 10) {
    return CLASSE_JORNADA_INTERNO
  }

  return CLASSE_JORNADA_PADRAO
}
