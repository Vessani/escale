import type { StatusViagem, Turno } from "@prisma/client"

export function classeBadgeTurno(turno: Turno) {
  return turno === "MANHA"
    ? "border-amber-200 bg-amber-100 text-amber-800 hover:bg-amber-100"
    : "border-indigo-200 bg-indigo-100 text-indigo-800 hover:bg-indigo-100"
}

export function classeBadgeStatusViagem(status: StatusViagem) {
  if (status === "CRIADA") {
    return "border-slate-300 bg-slate-100 text-slate-700 hover:bg-slate-100"
  }

  if (status === "ALOCADA") {
    return "border-blue-200 bg-blue-100 text-blue-800 hover:bg-blue-100"
  }

  if (status === "INICIADA" || status === "RETORNANDO") {
    return "border-cyan-200 bg-cyan-100 text-cyan-800 hover:bg-cyan-100"
  }

  if (status === "POSTERGADA") {
    return "border-amber-200 bg-amber-100 text-amber-800 hover:bg-amber-100"
  }

  if (status === "FINALIZADA") {
    return "border-emerald-200 bg-emerald-100 text-emerald-800 hover:bg-emerald-100"
  }

  if (status === "CANCELADA") {
    return "border-rose-200 bg-rose-100 text-rose-800 hover:bg-rose-100"
  }

  return "border-slate-300 bg-slate-100 text-slate-700 hover:bg-slate-100"
}
