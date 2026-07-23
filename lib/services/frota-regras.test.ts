import { describe, expect, it } from "vitest"
import { calcularStatusFrota, frotaEhValida, viagensCompartilhamFrota } from "@/lib/services/frota-regras"

describe("frotaEhValida", () => {
  it("é inválida pra código vazio ou placeholder '0000'", () => {
    expect(frotaEhValida("")).toBe(false)
    expect(frotaEhValida("0000")).toBe(false)
  })

  it("é válida pra qualquer outro código", () => {
    expect(frotaEhValida("75")).toBe(true)
  })
})

describe("viagensCompartilhamFrota", () => {
  it("detecta quando o cavalo de uma bate com o cavalo da outra", () => {
    expect(viagensCompartilhamFrota("75", "908", "75", "909")).toBe(true)
  })

  it("detecta quando a carreta de uma bate com a carreta da outra", () => {
    expect(viagensCompartilhamFrota("75", "908", "76", "908")).toBe(true)
  })

  it("detecta quando o cavalo de uma bate com a carreta da outra (cruzado)", () => {
    expect(viagensCompartilhamFrota("75", "908", "908", "77")).toBe(true)
  })

  it("não detecta coincidência quando nenhum código bate", () => {
    expect(viagensCompartilhamFrota("75", "908", "76", "909")).toBe(false)
  })

  it("ignora coincidência de placeholder '0000' entre viagens truck sem carreta separada", () => {
    expect(viagensCompartilhamFrota("75", "0000", "76", "0000")).toBe(false)
  })

  it("detecta caso truck: cavalo e carreta repetem o mesmo número em ambas as viagens", () => {
    expect(viagensCompartilhamFrota("75", "75", "75", "75")).toBe(true)
  })
})

describe("calcularStatusFrota", () => {
  const agora = new Date("2026-07-21T12:00:00")

  it("é DISPONIVEL quando disponivelEm é nulo", () => {
    expect(calcularStatusFrota(null, agora)).toBe("DISPONIVEL")
  })

  it("é DISPONIVEL quando disponivelEm já passou", () => {
    expect(calcularStatusFrota(new Date("2026-07-20T12:00:00"), agora)).toBe("DISPONIVEL")
  })

  it("é DISPONIVEL quando disponivelEm é exatamente agora", () => {
    expect(calcularStatusFrota(agora, agora)).toBe("DISPONIVEL")
  })

  it("é MANUTENCAO quando disponivelEm é no futuro", () => {
    expect(calcularStatusFrota(new Date("2026-07-22T18:30:00"), agora)).toBe("MANUTENCAO")
  })
})
