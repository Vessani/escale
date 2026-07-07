export const CLASSE_JORNADA_1_3 = "bg-emerald-100 text-emerald-800 border border-emerald-200"
export const CLASSE_JORNADA_4_5 = "bg-yellow-100 text-yellow-800 border border-yellow-200"
export const CLASSE_JORNADA_6 = "bg-orange-100 text-orange-800 border border-orange-200"
export const CLASSE_JORNADA_FOLGA = "bg-sky-100 text-sky-800 border border-sky-200"
export const CLASSE_JORNADA_FERIAS = "bg-indigo-100 text-indigo-800 border border-indigo-200"
export const CLASSE_JORNADA_EXAMES = "bg-rose-100 text-rose-800 border border-rose-200"
export const CLASSE_JORNADA_INTERNO = "bg-slate-200 text-slate-800 border border-slate-300"
export const CLASSE_JORNADA_PADRAO = "bg-slate-100 text-slate-700 border border-slate-200"

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
