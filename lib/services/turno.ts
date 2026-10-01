import type { Turno } from "@prisma/client"

/**
 * Turno da viagem pelo horário de início (Brasília): a partir das 16:00 é
 * da noite, antes disso é do dia — mesma regra do import da planilha. Sem
 * dependências, usado também nos formulários (navegador).
 */
export const HORA_CORTE_TURNO_NOITE = 16

const OFFSET_BRASILIA_MS = 3 * 60 * 60 * 1000

export function turnoPorHora(hora: number): Turno {
  return hora >= HORA_CORTE_TURNO_NOITE ? "NOITE" : "MANHA"
}

/** Turno de um instante (Date, ISO ou "YYYY-MM-DDTHH:MM" do datetime-local, que já é horário de Brasília). */
export function turnoPorHorario(inicio: Date | string): Turno | null {
  if (typeof inicio === "string") {
    const local = inicio.match(/^\d{4}-\d{2}-\d{2}T(\d{2}):\d{2}/)
    if (local && !/[zZ]|[+-]\d{2}:?\d{2}$/.test(inicio)) return turnoPorHora(Number(local[1]))
  }
  const data = new Date(inicio)
  if (Number.isNaN(data.getTime())) return null
  return turnoPorHora(new Date(data.getTime() - OFFSET_BRASILIA_MS).getUTCHours())
}
