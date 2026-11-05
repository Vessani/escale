import { CODIGO_EXAMES, CODIGO_FERIAS, CODIGO_FOLGA, CODIGO_INTERNO, CODIGO_MANUTENCAO } from "@/lib/services/codigo-jornada"
import { MAX_DIAS_SEM_FOLGA } from "@/lib/services/dias-sem-folga"

/**
 * Mesmo estilo "sutil" (fundo bem claro + texto colorido) das variantes
 * semânticas do Badge (ver components/ui/badge.tsx) — aqui como classes
 * centralizadas porque o calendário de jornada tem mais gradações de cor
 * (a severidade de 1 a 6, depois os status de 7 a 11) do que as 3
 * variantes semânticas cobrem.
 */
export const CLASSE_JORNADA_1_3 = "bg-success/10 text-success border border-success/30"
export const CLASSE_JORNADA_4_5 = "bg-yellow-500/10 text-yellow-600 border border-yellow-500/30"
export const CLASSE_JORNADA_6 = "bg-warning/10 text-warning border border-warning/30"
export const CLASSE_JORNADA_FOLGA = "bg-sky-500/10 text-sky-600 border border-sky-500/30"
export const CLASSE_JORNADA_FERIAS = "bg-indigo-500/10 text-indigo-600 border border-indigo-500/30"
export const CLASSE_JORNADA_EXAMES = "bg-rose-500/10 text-rose-600 border border-rose-500/30"
export const CLASSE_JORNADA_INTERNO = "bg-muted text-muted-foreground border border-border"
export const CLASSE_JORNADA_MANUTENCAO = "bg-orange-500/10 text-orange-600 border border-orange-500/30"
const CLASSE_JORNADA_PADRAO = "bg-muted text-muted-foreground border border-border"

const CLASSE_DO_STATUS: Record<number, string> = {
  [CODIGO_FOLGA]: CLASSE_JORNADA_FOLGA,
  [CODIGO_FERIAS]: CLASSE_JORNADA_FERIAS,
  [CODIGO_EXAMES]: CLASSE_JORNADA_EXAMES,
  [CODIGO_INTERNO]: CLASSE_JORNADA_INTERNO,
  [CODIGO_MANUTENCAO]: CLASSE_JORNADA_MANUTENCAO,
}

export function classeBadgeJornada(codigo: number): string {
  if (codigo >= 1 && codigo <= 3) {
    return CLASSE_JORNADA_1_3
  }

  if (codigo >= 4 && codigo <= 5) {
    return CLASSE_JORNADA_4_5
  }

  if (codigo === MAX_DIAS_SEM_FOLGA) {
    return CLASSE_JORNADA_6
  }

  return CLASSE_DO_STATUS[codigo] ?? CLASSE_JORNADA_PADRAO
}
