import { describe, expect, it } from "vitest"
import { calcularDescarga, parseNumeroDecimal, textoLeituras, textoMedicao, unidadeDescarga } from "./descarga"

describe("calcularDescarga — balança", () => {
  const balanca = { medicao: "BALANCA" as const }

  it("caso real (tela WM): peso do caminhão 47.760 → 23.400 kg de nitrogênio = 24.360 kg = 20.998,32 m³", () => {
    const r = calcularDescarga({
      ...balanca,
      produto: "NITROGENIO",
      kgInicial: 47760,
      kgFinal: 23400,
      // Tanque do cliente, na mesma tela: sobe.
      m3Inicial: 35515.4,
      m3Final: 50139.39,
      polInicial: 51,
      polFinal: 72,
    })
    expect(r).toEqual({
      ok: true,
      total: 20998.32,
      fator: 0.862,
      unidade: "m³",
      medicao: "BALANCA",
      nivelInicial: 47760,
      nivelFinal: 23400,
      linhas: {
        kg: { inicial: 47760, final: 23400, descarregado: 24360, convertido: 20998.32 },
        m3: { inicial: 35515.4, final: 50139.39, descarregado: 14623.99 },
        pol: { inicial: 51, final: 72, descarregado: 21 },
        pct: null,
      },
    })
  })

  it("kg × fator do produto; CO2 fica em kg; as outras linhas não mudam o total", () => {
    expect(calcularDescarga({ ...balanca, produto: "OXIGENIO", kgInicial: 1000, kgFinal: 400 })).toMatchObject({
      total: 452.4,
      unidade: "m³",
    })
    expect(calcularDescarga({ ...balanca, produto: "ARGONIO", kgInicial: 500, kgFinal: 0 })).toMatchObject({ total: 302 })
    expect(calcularDescarga({ ...balanca, produto: "CO2", kgInicial: 800, kgFinal: 300 })).toMatchObject({ total: 500, unidade: "kg" })
    expect(
      calcularDescarga({ ...balanca, produto: "OXIGENIO", kgInicial: 1000, kgFinal: 400, pctInicial: 20, pctFinal: 65 }),
    ).toMatchObject({ total: 452.4, linhas: { pct: { descarregado: 45 } } })
  })

  it("recusa: peso do caminhão subindo (o caso da foto), sem a linha kg, % acima de 100", () => {
    expect(calcularDescarga({ ...balanca, produto: "NITROGENIO", kgInicial: 4457, kgFinal: 45720 })).toMatchObject({
      ok: false,
      erro: expect.stringContaining("o final tem que ser menor que o inicial"),
    })
    // O caso da foto do motorista (45.720 → 4.457) agora passa.
    expect(calcularDescarga({ ...balanca, produto: "NITROGENIO", kgInicial: 45720, kgFinal: 4457 })).toMatchObject({ ok: true })
    expect(calcularDescarga({ ...balanca, produto: "OXIGENIO", m3Inicial: 10, m3Final: 20 })).toMatchObject({
      ok: false,
      erro: expect.stringContaining("linha kg"),
    })
    expect(
      calcularDescarga({ ...balanca, produto: "OXIGENIO", kgInicial: 1000, kgFinal: 400, pctInicial: 20, pctFinal: 120 }),
    ).toMatchObject({ ok: false, erro: expect.stringContaining("0 a 100") })
  })
})

describe("calcularDescarga — manômetro", () => {
  const manometro = { medicao: "MANOMETRO" as const }

  it("como antes: (pol final − pol inicial) × conversão do cliente; demais linhas só registram", () => {
    // Caso real: nitrogênio, 122" → 250", conversão 131,92
    expect(
      calcularDescarga({
        ...manometro,
        produto: "NITROGENIO",
        polInicial: 122,
        polFinal: 250,
        fatorCliente: 131.92,
        m3Inicial: 100,
        m3Final: 900,
      }),
    ).toEqual({
      ok: true,
      total: 16885.76,
      fator: 131.92,
      unidade: "",
      medicao: "MANOMETRO",
      nivelInicial: 122,
      nivelFinal: 250,
      linhas: {
        pol: { inicial: 122, final: 250, descarregado: 128 },
        m3: { inicial: 100, final: 900, descarregado: 800 },
        kg: null,
        pct: null,
      },
    })
  })

  it("recusa: sem pol, sem conversão, tanque do cliente descendo, linha pela metade", () => {
    expect(calcularDescarga({ ...manometro, produto: "OXIGENIO", m3Inicial: 1, m3Final: 2, fatorCliente: 12 })).toMatchObject({
      ok: false,
      erro: expect.stringContaining("polegadas"),
    })
    expect(calcularDescarga({ ...manometro, produto: "OXIGENIO", polInicial: 30, polFinal: 80, fatorCliente: 0 })).toMatchObject({
      ok: false,
      erro: expect.stringContaining("conversão do cliente"),
    })
    expect(calcularDescarga({ ...manometro, produto: "OXIGENIO", polInicial: 80, polFinal: 30, fatorCliente: 12.5 })).toMatchObject({
      ok: false,
      erro: expect.stringContaining("tanque do cliente"),
    })
    expect(
      calcularDescarga({
        ...manometro,
        produto: "OXIGENIO",
        polInicial: 30,
        polFinal: 80,
        fatorCliente: 12.5,
        kgInicial: 1000,
        kgFinal: null,
      }),
    ).toMatchObject({ ok: false, erro: expect.stringContaining("Linha kg: informe") })
  })

  it("recusa sem medida escolhida ou viagem sem produto", () => {
    expect(calcularDescarga({ produto: "OXIGENIO", medicao: null, kgInicial: 5, kgFinal: 2 })).toMatchObject({
      ok: false,
      erro: expect.stringContaining("manômetro ou balança"),
    })
    expect(calcularDescarga({ produto: null, medicao: "BALANCA", kgInicial: 5, kgFinal: 2 })).toMatchObject({
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
  it("com linhas: medição pela medida escolhida e leituras de todas as linhas preenchidas", () => {
    const c = {
      medicao: "BALANCA" as const,
      fator: 0.862,
      nivelInicial: 47760,
      nivelFinal: 23400,
      kgInicial: 47760,
      kgFinal: 23400,
      polInicial: 51,
      polFinal: 72,
    }
    expect(textoMedicao(c)).toBe("Balança × 0,862")
    expect(unidadeDescarga(c)).toBe("m³")
    expect(textoLeituras(c)).toBe("pol 51 → 72 · kg 47.760 → 23.400")
  })

  it("antigas (uma leitura só), biometano e GRADE continuam aparecendo como eram", () => {
    expect(textoMedicao({ medicao: "MANOMETRO", fator: 131.92 })).toBe("Manômetro × 131,92")
    expect(unidadeDescarga({ medicao: "MANOMETRO", fator: 131.92 })).toBe("")
    expect(textoLeituras({ ...base, medicao: "BALANCA", fator: 0.754, nivelInicial: 1000, nivelFinal: 400 })).toBe("1.000 → 400")
    expect(textoLeituras({ medicao: null, fator: null, nivelInicial: 950, nivelFinal: 200, polInicial: 80, polFinal: 15 })).toBe(
      "950 → 200 m³ (80 → 15 pol)",
    )
    const grade = { ...base, medicao: "GRADE" as const, fator: 0.754, nivelInicial: 400, nivelFinal: 1000, kgInicial: 400, kgFinal: 1000 }
    expect(textoMedicao(grade)).toBe("Grade (kg × 0,754)")
    expect(textoLeituras(grade)).toBe("kg 400 → 1.000")
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
