import { describe, expect, it } from "vitest"
import { totaisDespesas } from "./despesas-viagem"

describe("totaisDespesas", () => {
  it("soma pedágio e pernoite separados e o total", () => {
    expect(
      totaisDespesas([
        { tipo: "PEDAGIO", valorCentavos: 1250 },
        { tipo: "PERNOITE", valorCentavos: 8000 },
        { tipo: "PEDAGIO", valorCentavos: 890 },
      ]),
    ).toEqual({
      pedagioCentavos: 2140,
      pernoiteCentavos: 8000,
      totalCentavos: 10140,
    })
    expect(totaisDespesas([])).toEqual({ pedagioCentavos: 0, pernoiteCentavos: 0, totalCentavos: 0 })
  })
})
