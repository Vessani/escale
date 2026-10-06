import { describe, expect, it } from "vitest"
import { turnoDaJornada, turnoPorHorario } from "./turno"

describe("turnoPorHorario", () => {
  it("a partir das 16:00 (Brasília) é noite", () => {
    expect(turnoPorHorario(new Date("2026-10-01T15:59:00-03:00"))).toBe("MANHA")
    expect(turnoPorHorario(new Date("2026-10-01T16:00:00-03:00"))).toBe("NOITE")
    expect(turnoPorHorario("2026-10-01T22:30")).toBe("NOITE")
    expect(turnoPorHorario("2026-10-01T07:00")).toBe("MANHA")
    expect(turnoPorHorario("2026-10-01T18:59:00.000Z")).toBe("MANHA")
    expect(turnoPorHorario("2026-10-01T19:00:00.000Z")).toBe("NOITE")
    expect(turnoPorHorario("2026-10-01T03:30")).toBe("NOITE")
    expect(turnoPorHorario("2026-10-01T04:00")).toBe("MANHA")
    expect(turnoPorHorario("lixo")).toBeNull()
  })
})

describe("turnoDaJornada (ciclo circadiano)", () => {
  // Horários de Brasília (UTC-3).
  const bsb = (hora: string) => new Date(`2026-09-10T${hora}:00-03:00`)

  it("dia de 04:00 a 15:59, noite de 16:00 a 03:59", () => {
    expect(turnoDaJornada(bsb("03:59"))).toBe("NOITE")
    expect(turnoDaJornada(bsb("04:00"))).toBe("MANHA")
    expect(turnoDaJornada(bsb("15:59"))).toBe("MANHA")
    expect(turnoDaJornada(bsb("16:00"))).toBe("NOITE")
    expect(turnoDaJornada(bsb("00:30"))).toBe("NOITE")
  })
})
