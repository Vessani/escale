import { describe, expect, it } from "vitest"
import { folgaEstourada, MAX_DIAS_SEM_FOLGA } from "./dias-sem-folga"
import { MAX_DIAS_CONSECUTIVOS } from "./alocacao/compatibilidade"

describe("folgaEstourada", () => {
  it("7º dia seguido em diante é estouro; até o 6º não", () => {
    expect(folgaEstourada(6)).toBe(false)
    expect(folgaEstourada(7)).toBe(true)
    expect(folgaEstourada(10)).toBe(true)
    expect(folgaEstourada(null)).toBe(false)
  })

  it("é o mesmo limite da regra de alocação", () => {
    expect(MAX_DIAS_CONSECUTIVOS).toBe(MAX_DIAS_SEM_FOLGA)
  })
})
