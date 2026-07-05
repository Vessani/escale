import type { StatusViagem } from "@prisma/client"

export const STATUS_VIAGEM_VALORES = [
  "CRIADA",
  "ALOCADA",
  "INICIADA",
  "RETORNANDO",
  "POSTERGADA",
  "FINALIZADA",
  "CANCELADA",
  "EM_CURSO",
] as const satisfies readonly StatusViagem[]

const STATUS_VIAGEM_LABELS: Record<StatusViagem, string> = {
  CRIADA: "Criada",
  ALOCADA: "Alocada",
  INICIADA: "Iniciada",
  RETORNANDO: "Retornando",
  POSTERGADA: "Postergada",
  FINALIZADA: "Finalizada",
  CANCELADA: "Cancelada",
  EM_CURSO: "Em curso (legado)",
}

export const STATUS_VIAGEM_OPCOES: Array<{ valor: StatusViagem; label: string }> =
  STATUS_VIAGEM_VALORES.map((valor) => ({
    valor,
    label: STATUS_VIAGEM_LABELS[valor],
  }))

export function ehStatusViagem(valor: string): valor is StatusViagem {
  return STATUS_VIAGEM_VALORES.some((item) => item === valor)
}

export function formatarStatusViagem(status: StatusViagem) {
  return STATUS_VIAGEM_LABELS[status]
}
