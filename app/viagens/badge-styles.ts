import type { StatusViagem, Turno } from "@prisma/client"

/**
 * Mesmo estilo "sutil" (fundo bem claro + texto colorido, sem preenchimento
 * sólido) usado pelas variantes semânticas do Badge (ver components/ui/badge.tsx)
 * — aplicado aqui via className porque turno/status têm mais cores distintas
 * (indigo, ciano/chart-2, rose) do que as 3 variantes semânticas cobrem. As
 * cores de status batem com CORES_STATUS (app/relatorios/dashboard-relatorios.tsx).
 */
export function classeBadgeTurno(turno: Turno) {
  return turno === "MANHA"
    ? "border-warning/30 bg-warning/10 text-warning hover:bg-warning/10"
    : "border-indigo-500/30 bg-indigo-500/10 text-indigo-600 hover:bg-indigo-500/10"
}

export function classeBadgeStatusViagem(status: StatusViagem) {
  if (status === "CRIADA") {
    return "rounded-full border-border bg-muted text-muted-foreground hover:bg-muted"
  }

  if (status === "ALOCADA") {
    return "rounded-full border-info/30 bg-info/10 text-info hover:bg-info/10"
  }

  if (status === "INICIADA" || status === "RETORNANDO") {
    return "rounded-full border-chart-2/30 bg-chart-2/10 text-chart-2 hover:bg-chart-2/10"
  }

  if (status === "POSTERGADA") {
    return "rounded-full border-warning/30 bg-warning/10 text-warning hover:bg-warning/10"
  }

  if (status === "FINALIZADA") {
    return "rounded-full border-success/30 bg-success/10 text-success hover:bg-success/10"
  }

  if (status === "CANCELADA") {
    return "rounded-full border-destructive/30 bg-destructive/10 text-destructive hover:bg-destructive/10"
  }

  return "rounded-full border-border bg-muted text-muted-foreground hover:bg-muted"
}
