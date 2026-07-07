import { describe, expect, it } from "vitest"
import { statusJornadaCorrespondeAoFiltro } from "./calendario-utils"

describe("calendario-utils", () => {
  it("retorna true para qualquer status quando filtro é TODOS", () => {
    expect(statusJornadaCorrespondeAoFiltro(2, "TODOS")).toBe(true)
    expect(statusJornadaCorrespondeAoFiltro(9, "TODOS")).toBe(true)
  })

  it("aplica corretamente os filtros de jornada e status especiais", () => {
    expect(statusJornadaCorrespondeAoFiltro(2, "JORNADA_1_3")).toBe(true)
    expect(statusJornadaCorrespondeAoFiltro(5, "JORNADA_4_5")).toBe(true)
    expect(statusJornadaCorrespondeAoFiltro(6, "JORNADA_6")).toBe(true)
    expect(statusJornadaCorrespondeAoFiltro(7, "FOLGA")).toBe(true)
    expect(statusJornadaCorrespondeAoFiltro(8, "FERIAS")).toBe(true)
    expect(statusJornadaCorrespondeAoFiltro(9, "EXAMES")).toBe(true)
    expect(statusJornadaCorrespondeAoFiltro(10, "INTERNO")).toBe(true)
  })

  it("retorna false quando o motorista não corresponde ao filtro", () => {
    expect(statusJornadaCorrespondeAoFiltro(4, "JORNADA_1_3")).toBe(false)
    expect(statusJornadaCorrespondeAoFiltro(7, "EXAMES")).toBe(false)
  })
})
