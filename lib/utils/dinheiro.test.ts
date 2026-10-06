import { describe, expect, it } from "vitest"
import { formatarReais, parseReaisParaCentavos } from "./dinheiro"

describe("dinheiro", () => {
  it("lê o valor como a pessoa digita no celular", () => {
    expect(parseReaisParaCentavos("12")).toBe(1200)
    expect(parseReaisParaCentavos("12,5")).toBe(1250)
    expect(parseReaisParaCentavos("12,50")).toBe(1250)
    expect(parseReaisParaCentavos("12.50")).toBe(1250)
    expect(parseReaisParaCentavos("R$ 8,90")).toBe(890)
    expect(parseReaisParaCentavos("1.234,56")).toBe(123456)
    expect(parseReaisParaCentavos("1.234")).toBe(123400)
  })

  it("recusa o que não é valor", () => {
    for (const texto of ["", "abc", "12,345", "1,2,3", "-5"]) expect(parseReaisParaCentavos(texto)).toBeNull()
  })

  it("formata em reais", () => {
    expect(formatarReais(123456).replace(/\s/g, " ")).toBe("R$ 1.234,56")
  })
})

describe("reaisNoCampo / formatarReaisOuTraco", () => {
  it("volta pro campo no formato que parseReaisParaCentavos lê; zero vira traço no relatório", async () => {
    const { reaisNoCampo, formatarReaisOuTraco, parseReaisParaCentavos } = await import("./dinheiro")
    expect(reaisNoCampo(123450)).toBe("1234,50")
    expect(parseReaisParaCentavos(reaisNoCampo(123450))).toBe(123450)
    expect(formatarReaisOuTraco(0)).toBe("—")
  })
})
