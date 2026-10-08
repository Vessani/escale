import { describe, expect, it } from "vitest"
import { calcularDescarga, parseNumeroDecimal, textoLeituras, textoMedicao, unidadeDescarga } from "./descarga"

describe("calcularDescarga — grade m³ / kg / %", () => {
  const grade = { medicao: "GRADE" as const }

  it("kg (balança): (final − inicial) × fator do produto; CO2 fica em kg", () => {
    expect(calcularDescarga({ ...grade, produto: "OXIGENIO", kgInicial: 400, kgFinal: 1000 })).toEqual({
      ok: true,
      total: 452.4,
      fator: 0.754,
      unidade: "m³",
      medicao: "GRADE",
      nivelInicial: 400,
      nivelFinal: 1000,
      referencia: "KG",
      linhas: { kg: { inicial: 400, final: 1000, descarregado: 600, convertido: 452.4 }, m3: null, pct: null },
      aviso: null,
    })
    expect(calcularDescarga({ ...grade, produto: "ARGONIO", kgInicial: 0, kgFinal: 500 })).toMatchObject({ total: 302 })
    expect(calcularDescarga({ ...grade, produto: "NITROGENIO", kgInicial: 50, kgFinal: 100 })).toMatchObject({ total: 43.1 })
    expect(calcularDescarga({ ...grade, produto: "CO2", kgInicial: 300, kgFinal: 800 })).toMatchObject({ total: 500, unidade: "kg" })
  })

  it("só m³ ou só %: o total vem da própria linha (% sem conversão)", () => {
    expect(calcularDescarga({ ...grade, produto: "OXIGENIO", m3Inicial: 12.5, m3Final: 28 })).toMatchObject({
      ok: true,
      total: 15.5,
      unidade: "m³",
      fator: null,
      referencia: "M3",
      nivelInicial: 12.5,
      nivelFinal: 28,
    })
    expect(calcularDescarga({ ...grade, produto: "NITROGENIO", pctInicial: 38, pctFinal: 85 })).toMatchObject({
      ok: true,
      total: 47,
      unidade: "%",
      referencia: "PCT",
    })
  })

  it("várias linhas: referência kg > m³ > %, e todas aparecem calculadas", () => {
    const r = calcularDescarga({
      ...grade,
      produto: "OXIGENIO",
      kgInicial: 400,
      kgFinal: 1000,
      m3Inicial: 10,
      m3Final: 10.45,
      pctInicial: 20,
      pctFinal: 30,
    })
    expect(r).toMatchObject({ ok: true, total: 452.4, referencia: "KG" })
    if (!r.ok) throw new Error()
    expect(r.linhas.m3?.descarregado).toBe(0.45)
    expect(r.linhas.pct?.descarregado).toBe(10)
    expect(calcularDescarga({ ...grade, produto: "OXIGENIO", m3Inicial: 10, m3Final: 25, pctInicial: 20, pctFinal: 70 })).toMatchObject({
      total: 15,
      unidade: "m³",
      referencia: "M3",
    })
  })

  it("kg e m³ divergentes além de 3%: avisa, mas não bloqueia (total pela balança)", () => {
    // 600 kg × 0,754 = 452,4 m³ — informou 440 m³ (2,7%): sem aviso
    expect(calcularDescarga({ ...grade, produto: "OXIGENIO", kgInicial: 400, kgFinal: 1000, m3Inicial: 0, m3Final: 440 })).toMatchObject({
      ok: true,
      aviso: null,
    })
    // informou 400 m³ (11,6%): avisa
    const r = calcularDescarga({ ...grade, produto: "OXIGENIO", kgInicial: 400, kgFinal: 1000, m3Inicial: 0, m3Final: 400 })
    expect(r).toMatchObject({ ok: true, total: 452.4, aviso: expect.stringContaining("não batem") })
    // CO2 fica em kg: não compara com m³
    expect(calcularDescarga({ ...grade, produto: "CO2", kgInicial: 0, kgFinal: 500, m3Inicial: 0, m3Final: 1 })).toMatchObject({
      ok: true,
      aviso: null,
    })
  })

  it("recusa: linha pela metade, final menor que o inicial, % acima de 100, grade vazia, viagem sem produto", () => {
    expect(calcularDescarga({ ...grade, produto: "OXIGENIO", kgInicial: 400, kgFinal: null })).toMatchObject({
      ok: false,
      erro: expect.stringContaining("Linha kg: informe o inicial e o final"),
    })
    expect(calcularDescarga({ ...grade, produto: "OXIGENIO", kgInicial: 1000, kgFinal: 400 })).toMatchObject({
      ok: false,
      erro: expect.stringContaining("Linha kg: o final tem que ser maior que o inicial"),
    })
    expect(calcularDescarga({ ...grade, produto: "OXIGENIO", m3Inicial: 28, m3Final: 12.5 })).toMatchObject({
      ok: false,
      erro: expect.stringContaining("Linha m³"),
    })
    expect(calcularDescarga({ ...grade, produto: "OXIGENIO", pctInicial: 20, pctFinal: 120 })).toMatchObject({
      ok: false,
      erro: expect.stringContaining("0 a 100"),
    })
    expect(calcularDescarga({ ...grade, produto: "OXIGENIO" })).toMatchObject({
      ok: false,
      erro: expect.stringContaining("pelo menos uma linha"),
    })
    expect(calcularDescarga({ ...grade, produto: null, kgInicial: 1, kgFinal: 2 })).toMatchObject({
      ok: false,
      erro: expect.stringContaining("sem produto"),
    })
  })
})

describe("calcularDescarga — biometano", () => {
  it("m³ inicial − m³ final (tanque do caminhão, desce), exige também as polegadas", () => {
    expect(
      calcularDescarga({ produto: "BIOMETANO", medicao: null, nivelInicial: 950.5, nivelFinal: 200.25, polInicial: 80, polFinal: 15 }),
    ).toMatchObject({ ok: true, total: 750.25, fator: null, unidade: "m³", medicao: null, nivelInicial: 950.5, nivelFinal: 200.25 })
    expect(
      calcularDescarga({ produto: "BIOMETANO", medicao: null, nivelInicial: 950, nivelFinal: 200, polInicial: 15, polFinal: 80 }),
    ).toMatchObject({ ok: false, erro: expect.stringContaining("polegadas") })
    expect(calcularDescarga({ produto: "BIOMETANO", medicao: null, nivelInicial: 950, nivelFinal: 200 })).toMatchObject({
      ok: false,
      erro: expect.stringContaining("polegadas"),
    })
    expect(
      calcularDescarga({ produto: "BIOMETANO", medicao: null, nivelInicial: 200, nivelFinal: 950, polInicial: 80, polFinal: 15 }),
    ).toMatchObject({
      ok: false,
      erro: expect.stringContaining("maior que o inicial"),
    })
  })
})

describe("textos de uma chegada gravada", () => {
  const base = { polInicial: null, polFinal: null }
  it("grade: medição pela linha de referência e leituras de todas as linhas preenchidas", () => {
    const c = {
      ...base,
      medicao: "GRADE" as const,
      fator: 0.754,
      nivelInicial: 400,
      nivelFinal: 1000,
      kgInicial: 400,
      kgFinal: 1000,
      m3Inicial: 10,
      m3Final: 10.45,
      pctInicial: null,
      pctFinal: null,
    }
    expect(textoMedicao(c)).toBe("Grade (kg × 0,754)")
    expect(unidadeDescarga(c)).toBe("m³")
    expect(textoLeituras(c)).toBe("kg 400 → 1.000 · m³ 10 → 10,45")
    const pct = { ...base, medicao: "GRADE" as const, fator: null, nivelInicial: 38, nivelFinal: 85, pctInicial: 38, pctFinal: 85 }
    expect(textoMedicao(pct)).toBe("Grade (%)")
    expect(unidadeDescarga(pct)).toBe("%")
    expect(unidadeDescarga({ ...base, medicao: "GRADE", fator: 1, kgInicial: 0, kgFinal: 5 })).toBe("kg")
  })

  it("registros antigos (manômetro/balança) continuam aparecendo como eram", () => {
    expect(textoMedicao({ medicao: "MANOMETRO", fator: 131.92 })).toBe("Manômetro × 131,92")
    expect(unidadeDescarga({ medicao: "MANOMETRO", fator: 131.92 })).toBe("")
    expect(textoMedicao({ medicao: "BALANCA", fator: 0.754 })).toBe("Balança × 0,754")
    expect(textoLeituras({ ...base, medicao: "BALANCA", fator: 0.754, nivelInicial: 400, nivelFinal: 1000 })).toBe("400 → 1.000")
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
