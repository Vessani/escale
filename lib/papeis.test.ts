import { describe, expect, it } from "vitest"
import { PAPEIS_LEITURA, ehTorre, veHistorico } from "@/lib/papeis"

describe("veHistorico", () => {
  it("só o Admin e a torre veem históricos e linha do tempo", () => {
    expect(veHistorico("ADMIN")).toBe(true)
    expect(veHistorico("TORRE")).toBe(true)
    for (const role of ["DESPACHANTE", "MOTORISTA", "SUPERADMIN", "", null, undefined]) expect(veHistorico(role)).toBe(false)
  })
})

describe("ehTorre", () => {
  it("só o papel TORRE", () => {
    expect(ehTorre("TORRE")).toBe(true)
    for (const role of ["ADMIN", "DESPACHANTE", "MOTORISTA", "SUPERADMIN", "", null, undefined]) expect(ehTorre(role)).toBe(false)
  })

  it("a torre entra nas telas de consulta junto com quem opera", () => {
    expect(PAPEIS_LEITURA).toEqual(["ADMIN", "DESPACHANTE", "TORRE"])
  })
})
