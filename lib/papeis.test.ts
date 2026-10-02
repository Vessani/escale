import { describe, expect, it } from "vitest"
import { ehGerencia } from "@/lib/papeis"

describe("ehGerencia", () => {
  it("só o Admin vê históricos e linha do tempo", () => {
    expect(ehGerencia("ADMIN")).toBe(true)
    for (const role of ["DESPACHANTE", "MOTORISTA", "SUPERADMIN", "", null, undefined]) expect(ehGerencia(role)).toBe(false)
  })
})
