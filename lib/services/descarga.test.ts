import { describe, expect, it } from "vitest"
import { calcularDescarga, parseNumeroDecimal } from "./descarga"

describe("calcularDescarga", () => {
  it("balança: (inicial − final) × fator do produto; CO2 fica em kg", () => {
    expect(calcularDescarga({ produto: "OXIGENIO", medicao: "BALANCA", nivelInicial: 1000, nivelFinal: 400 })).toEqual({
      ok: true, total: 452.4, fator: 0.754, unidade: "m³", medicao: "BALANCA", nivelInicial: 1000, nivelFinal: 400,
    })
    expect(calcularDescarga({ produto: "ARGONIO", medicao: "BALANCA", nivelInicial: 500, nivelFinal: 0 })).toMatchObject({ total: 302 })
    expect(calcularDescarga({ produto: "NITROGENIO", medicao: "BALANCA", nivelInicial: 100, nivelFinal: 50 })).toMatchObject({ total: 43.1 })
    expect(calcularDescarga({ produto: "CO2", medicao: "BALANCA", nivelInicial: 800, nivelFinal: 300 })).toMatchObject({ total: 500, unidade: "kg" })
  })

  it("manômetro (tanque do cliente, sobe): (final − inicial) × conversão que o motorista informa", () => {
    // Caso real: nitrogênio, 122" → 250", conversão 131,92
    expect(calcularDescarga({ produto: "NITROGENIO", medicao: "MANOMETRO", nivelInicial: 122, nivelFinal: 250, fatorCliente: 131.92 })).toEqual({
      ok: true, total: 16885.76, fator: 131.92, unidade: "", medicao: "MANOMETRO", nivelInicial: 122, nivelFinal: 250,
    })
    expect(calcularDescarga({ produto: "OXIGENIO", medicao: "MANOMETRO", nivelInicial: 30, nivelFinal: 80, fatorCliente: 0 })).toMatchObject({ ok: false })
    // final menor que o inicial no manômetro = leituras trocadas
    expect(calcularDescarga({ produto: "OXIGENIO", medicao: "MANOMETRO", nivelInicial: 80, nivelFinal: 30, fatorCliente: 12.5 })).toMatchObject({
      ok: false, erro: expect.stringContaining("tanque do cliente"),
    })
  })

  it("biometano: m³ inicial − m³ final, exige também as polegadas", () => {
    expect(calcularDescarga({ produto: "BIOMETANO", medicao: null, nivelInicial: 950.5, nivelFinal: 200.25, polInicial: 80, polFinal: 15 })).toEqual({
      ok: true, total: 750.25, fator: null, unidade: "m³", medicao: null, nivelInicial: 950.5, nivelFinal: 200.25,
    })
    expect(calcularDescarga({ produto: "BIOMETANO", medicao: null, nivelInicial: 950, nivelFinal: 200, polInicial: 15, polFinal: 80 })).toMatchObject({ ok: false, erro: expect.stringContaining("polegadas") })
    expect(calcularDescarga({ produto: "BIOMETANO", medicao: null, nivelInicial: 950, nivelFinal: 200 })).toMatchObject({ ok: false, erro: expect.stringContaining("polegadas") })
  })

  it("recusa: final maior que inicial, leitura faltando, sem medida, viagem sem produto", () => {
    expect(calcularDescarga({ produto: "OXIGENIO", medicao: "BALANCA", nivelInicial: 100, nivelFinal: 200 })).toMatchObject({ ok: false, erro: expect.stringContaining("maior que o inicial") })
    expect(calcularDescarga({ produto: "OXIGENIO", medicao: "BALANCA", nivelInicial: null, nivelFinal: 2 })).toMatchObject({ ok: false })
    expect(calcularDescarga({ produto: "OXIGENIO", medicao: null, nivelInicial: 5, nivelFinal: 2 })).toMatchObject({ ok: false, erro: expect.stringContaining("manômetro ou balança") })
    expect(calcularDescarga({ produto: null, medicao: "BALANCA", nivelInicial: 5, nivelFinal: 2 })).toMatchObject({ ok: false, erro: expect.stringContaining("sem produto") })
  })
})

describe("parseNumeroDecimal", () => {
  it("aceita vírgula ou ponto decimal e milhar com ponto", () => {
    expect(parseNumeroDecimal("12,5")).toBe(12.5)
    expect(parseNumeroDecimal("1.234,5")).toBe(1234.5)
    expect(parseNumeroDecimal("12.5")).toBe(12.5)
    expect(parseNumeroDecimal("1.000")).toBe(1000)
    expect(parseNumeroDecimal("152.300")).toBe(152300)
    expect(parseNumeroDecimal("1.5")).toBe(1.5)
    // "0." nunca é milhar; fator de conversão: ponto é sempre decimal.
    expect(parseNumeroDecimal("0.754")).toBe(0.754)
    expect(parseNumeroDecimal("1.250", { pontoDecimal: true })).toBe(1.25)
    expect(parseNumeroDecimal("1.250")).toBe(1250)
    expect(parseNumeroDecimal("800")).toBe(800)
    expect(parseNumeroDecimal("")).toBeNull()
    expect(parseNumeroDecimal("abc")).toBeNull()
    expect(parseNumeroDecimal("-3")).toBeNull()
  })
})
