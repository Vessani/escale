import type { StatusViagem, Turno } from "@prisma/client"

/**
 * Mesmo estilo "sutil" (fundo bem claro + texto colorido, sem preenchimento
 * sólido) usado pelas variantes semânticas do Badge (ver components/ui/badge.tsx)
 * — aplicado aqui via className porque turno/status têm mais cores distintas
 * (indigo, cyan, rose) do que as 3 variantes semânticas cobrem.
 */
export function classeBadgeTurno(turno: Turno) {
  return turno === "MANHA"
    ? "border-warning/30 bg-warning/10 text-warning hover:bg-warning/10"
    : "border-indigo-500/30 bg-indigo-500/10 text-indigo-600 hover:bg-indigo-500/10"
}

export function classeBadgeStatusViagem(status: StatusViagem) {
  if (status === "CRIADA") {
    return "border-border bg-muted text-muted-foreground hover:bg-muted"
  }

  if (status === "ALOCADA") {
    return "border-info/30 bg-info/10 text-info hover:bg-info/10"
  }

  if (status === "INICIADA" || status === "RETORNANDO") {
    return "border-cyan-500/30 bg-cyan-500/10 text-cyan-600 hover:bg-cyan-500/10"
  }

  if (status === "POSTERGADA") {
    return "border-warning/30 bg-warning/10 text-warning hover:bg-warning/10"
  }

  if (status === "FINALIZADA") {
    return "border-success/30 bg-success/10 text-success hover:bg-success/10"
  }

  if (status === "CANCELADA") {
    return "border-destructive/30 bg-destructive/10 text-destructive hover:bg-destructive/10"
  }

  return "border-border bg-muted text-muted-foreground hover:bg-muted"
}
