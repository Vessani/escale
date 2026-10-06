import type { Turno } from "@prisma/client"

/**
 * Uma regra só de turno pelo horário de início (Brasília), usada na escala
 * (viagem, import da planilha, formulários) e no ciclo circadiano:
 * Dia de 04:00 a 15:59, Noite de 16:00 a 03:59 — quem sai de madrugada
 * ainda é do turno da noite. Sem dependências, roda também no navegador.
 */
const HORA_INICIO_TURNO_DIA = 4
const HORA_CORTE_TURNO_NOITE = 16

const OFFSET_BRASILIA_MS = 3 * 60 * 60 * 1000

export function turnoPorHora(hora: number): Turno {
  return hora >= HORA_INICIO_TURNO_DIA && hora < HORA_CORTE_TURNO_NOITE ? "MANHA" : "NOITE"
}

/**
 * Turno de uma jornada pro ciclo circadiano. Vale pra cada jornada, não pro
 * motorista — quem é cadastrado no dia e faz uma viagem à noite é cobrado
 * pelo limite da noite, e vice-versa.
 */
export function turnoDaJornada(inicio: Date): Turno {
  return turnoPorHora(new Date(inicio.getTime() - OFFSET_BRASILIA_MS).getUTCHours())
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
