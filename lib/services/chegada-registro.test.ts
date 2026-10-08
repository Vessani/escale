import { describe, expect, it } from "vitest"
import { montarRegistroChegada } from "./chegada-registro"

const h = (iso: string) => new Date(`${iso}-03:00`)
const agora = h("2026-10-02T12:00:00")
const viagem = { produto: "NITROGENIO" as const, kmInicial: 152300, horarioRealSaida: h("2026-10-02T07:00:00") }
const gradeKg = {
  km: 152410,
  chegadaEm: h("2026-10-02T09:30:00"),
  medicao: "GRADE" as const,
  kgInicial: 1000,
  kgFinal: 3000,
  m3Inicial: null,
  m3Final: null,
  pctInicial: null,
  pctFinal: null,
  polInicial: null,
  polFinal: null,
}

describe("montarRegistroChegada", () => {
  it("grade: grava as linhas preenchidas e o total da referência, refeito no servidor", () => {
    const registro = montarRegistroChegada({ ...gradeKg, pctInicial: 20, pctFinal: 60 }, viagem, "u1", agora)
    expect(registro).toMatchObject({
      km: 152410,
      medicao: "GRADE",
      fator: 0.862,
      totalDescarregado: 1724,
      nivelInicial: 1000,
      nivelFinal: 3000,
      kgInicial: 1000,
      kgFinal: 3000,
      m3Inicial: null,
      m3Final: null,
      pctInicial: 20,
      pctFinal: 60,
      usuarioId: "u1",
      polInicial: null,
      polFinal: null,
    })
  })

  it("pol só fica gravado no biometano; biometano não grava grade", () => {
    const comPol = { ...gradeKg, polInicial: 30, polFinal: 10 }
    expect(montarRegistroChegada(comPol, viagem, null, agora)).toMatchObject({ polInicial: null, polFinal: null })

    const bio = { ...comPol, medicao: null, nivelInicial: 900, nivelFinal: 300 }
    const registro = montarRegistroChegada(bio, { ...viagem, produto: "BIOMETANO" }, null, agora)
    expect(registro).toMatchObject({ polInicial: 30, polFinal: 10, totalDescarregado: 600, kgInicial: null, kgFinal: null })
  })

  it("recusa km abaixo do inicial, hora antes da saída ou no futuro e leitura impossível", () => {
    expect(() => montarRegistroChegada({ ...gradeKg, km: 152000 }, viagem, null, agora)).toThrow("menor que o km inicial")
    expect(() => montarRegistroChegada({ ...gradeKg, chegadaEm: h("2026-10-02T06:00:00") }, viagem, null, agora)).toThrow("antes da saída")
    expect(() => montarRegistroChegada({ ...gradeKg, chegadaEm: h("2026-10-03T09:00:00") }, viagem, null, agora)).toThrow("no futuro")
    expect(() => montarRegistroChegada({ ...gradeKg, kgFinal: null }, viagem, null, agora)).toThrow("Linha kg")
    expect(() => montarRegistroChegada({ ...gradeKg, kgInicial: 3000, kgFinal: 1000 }, viagem, null, agora)).toThrow("sobe com a descarga")
  })
})
