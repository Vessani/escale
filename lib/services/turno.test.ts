import { describe, expect, it } from "vitest"
import { turnoPorHorario } from "./turno"

describe("turnoPorHorario", () => {
  it("a partir das 16:00 (Brasília) é noite", () => {
    expect(turnoPorHorario(new Date("2026-10-01T15:59:00-03:00"))).toBe("MANHA")
    expect(turnoPorHorario(new Date("2026-10-01T16:00:00-03:00"))).toBe("NOITE")
    expect(turnoPorHorario("2026-10-01T22:30")).toBe("NOITE")
    expect(turnoPorHorario("2026-10-01T07:00")).toBe("MANHA")
    expect(turnoPorHorario("2026-10-01T18:59:00.000Z")).toBe("MANHA")
    expect(turnoPorHorario("2026-10-01T19:00:00.000Z")).toBe("NOITE")
    expect(turnoPorHorario("lixo")).toBeNull()
  })
})
