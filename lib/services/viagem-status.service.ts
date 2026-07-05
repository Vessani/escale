import type { StatusViagem } from "@prisma/client"

export const STATUS_VIAGEM_VALORES = [
  "CRIADA",
  "ALOCADA",
  "INICIADA",
  "RETORNANDO",
  "POSTERGADA",
  "FINALIZADA",
  "CANCELADA",
] as const satisfies readonly StatusViagem[]

export type StatusViagemSelecionavel = (typeof STATUS_VIAGEM_VALORES)[number]

const STATUS_VIAGEM_LABELS: Record<StatusViagemSelecionavel, string> = {
  CRIADA: "Criada",
  ALOCADA: "Alocada",
  INICIADA: "Iniciada",
  RETORNANDO: "Retornando",
  POSTERGADA: "Postergada",
  FINALIZADA: "Finalizada",
  CANCELADA: "Cancelada",
}

export const STATUS_VIAGEM_OPCOES: Array<{ valor: StatusViagemSelecionavel; label: string }> =
  STATUS_VIAGEM_VALORES.map((valor) => ({
    valor,
    label: STATUS_VIAGEM_LABELS[valor],
  }))

export function normalizarStatusViagem(status: StatusViagem): StatusViagemSelecionavel {
  return status
}

export function ehStatusViagem(valor: string): valor is StatusViagemSelecionavel {
  return STATUS_VIAGEM_VALORES.some((item) => item === valor)
}

export function formatarStatusViagem(status: StatusViagem) {
  return STATUS_VIAGEM_LABELS[normalizarStatusViagem(status)]
}
