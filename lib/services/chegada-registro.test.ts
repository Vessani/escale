import { describe, expect, it } from "vitest"
import { montarRegistroChegada } from "./chegada-registro"

const h = (iso: string) => new Date(`${iso}-03:00`)
const agora = h("2026-10-02T12:00:00")
const viagem = { produto: "NITROGENIO" as const, kmInicial: 152300, horarioRealSaida: h("2026-10-02T07:00:00") }
const linhasVazias = { m3Inicial: null, m3Final: null, kgInicial: null, kgFinal: null, pctInicial: null, pctFinal: null }
const manometro = {
  km: 152410,
  chegadaEm: h("2026-10-02T09:30:00"),
  medicao: "MANOMETRO" as const,
  polInicial: 122,
  polFinal: 250,
  fatorCliente: 131.92,
  ...linhasVazias,
}

describe("montarRegistroChegada", () => {
  it("manômetro: total = (pol final − inicial) × conversão do cliente, refeito no servidor; pol vai nos campos pol", () => {
    const registro = montarRegistroChegada({ ...manometro, m3Inicial: 100, m3Final: 900 }, viagem, "u1", agora)
    expect(registro).toMatchObject({
      km: 152410,
      medicao: "MANOMETRO",
      fator: 131.92,
      usuarioId: "u1",
      nivelInicial: 122,
      nivelFinal: 250,
      polInicial: 122,
      polFinal: 250,
      m3Inicial: 100,
      m3Final: 900,
      kgInicial: null,
    })
    expect(registro.totalDescarregado).toBeCloseTo((250 - 122) * 131.92, 2)
  })

  it("balança (caso real WM): peso do caminhão cai, total pelo kg; linhas do tanque do cliente gravadas", () => {
    const balanca = {
      ...manometro,
      medicao: "BALANCA" as const,
      fatorCliente: null,
      polInicial: 51,
      polFinal: 72,
      kgInicial: 47760,
      kgFinal: 23400,
    }
    expect(montarRegistroChegada(balanca, viagem, null, agora)).toMatchObject({
      medicao: "BALANCA",
      fator: 0.862,
      totalDescarregado: 20998.32,
      nivelInicial: 47760,
      nivelFinal: 23400,
      kgInicial: 47760,
      kgFinal: 23400,
      polInicial: 51,
      polFinal: 72,
    })
  })

  it("biometano: pol do tanque do caminhão, sem linhas", () => {
    const bio = { ...manometro, medicao: null, polInicial: 30, polFinal: 10, nivelInicial: 900, nivelFinal: 300 }
    const registro = montarRegistroChegada(bio, { ...viagem, produto: "BIOMETANO" }, null, agora)
    expect(registro).toMatchObject({ polInicial: 30, polFinal: 10, totalDescarregado: 600, kgInicial: null, m3Inicial: null })
  })

  it("recusa km abaixo do inicial, hora antes da saída ou no futuro e leitura impossível", () => {
    expect(() => montarRegistroChegada({ ...manometro, km: 152000 }, viagem, null, agora)).toThrow("menor que o km inicial")
    expect(() => montarRegistroChegada({ ...manometro, chegadaEm: h("2026-10-02T06:00:00") }, viagem, null, agora)).toThrow(
      "antes da saída",
    )
    expect(() => montarRegistroChegada({ ...manometro, chegadaEm: h("2026-10-03T09:00:00") }, viagem, null, agora)).toThrow("no futuro")
    expect(() => montarRegistroChegada({ ...manometro, fatorCliente: null }, viagem, null, agora)).toThrow("conversão do cliente")
    expect(() =>
      montarRegistroChegada({ ...manometro, medicao: "BALANCA", kgInicial: 23400, kgFinal: 47760 }, viagem, null, agora),
    ).toThrow("menor que o inicial")
  })
})
