import type { Turno } from "@prisma/client"

/**
 * Turno da viagem pelo horário de início (Brasília): a partir das 16:00 é
 * da noite, antes disso é do dia — mesma regra do import da planilha. Sem
 * dependências, usado também nos formulários (navegador).
 */
const HORA_CORTE_TURNO_NOITE = 16

const OFFSET_BRASILIA_MS = 3 * 60 * 60 * 1000

export function turnoPorHora(hora: number): Turno {
  return hora >= HORA_CORTE_TURNO_NOITE ? "NOITE" : "MANHA"
}

/** No ciclo circadiano, jornada que começa de madrugada (00:00–03:59) ainda é do turno da noite. */
const HORA_INICIO_TURNO_DIA = 4

/**
 * Turno de uma jornada pro ciclo circadiano, pelo horário de início
 * (Brasília): Dia de 04:00 a 15:59, Noite de 16:00 a 03:59. Vale pra cada
 * jornada, não pro motorista — quem é cadastrado no dia e faz uma viagem à
 * noite é cobrado pelo limite da noite, e vice-versa.
 */
export function turnoDaJornada(inicio: Date): Turno {
  const hora = new Date(inicio.getTime() - OFFSET_BRASILIA_MS).getUTCHours()
  return hora >= HORA_INICIO_TURNO_DIA && hora < HORA_CORTE_TURNO_NOITE ? "MANHA" : "NOITE"
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
