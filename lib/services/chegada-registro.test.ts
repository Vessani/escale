import { describe, expect, it } from "vitest"
import { montarRegistroChegada } from "./chegada-registro"

const h = (iso: string) => new Date(`${iso}-03:00`)
const agora = h("2026-10-02T12:00:00")
const viagem = { produto: "NITROGENIO" as const, kmInicial: 152300, horarioRealSaida: h("2026-10-02T07:00:00") }
const manometro = {
  km: 152410,
  chegadaEm: h("2026-10-02T09:30:00"),
  medicao: "MANOMETRO" as const,
  nivelInicial: 122,
  nivelFinal: 250,
  fatorCliente: 131.92,
  polInicial: null,
  polFinal: null,
}

describe("montarRegistroChegada", () => {
  it("manômetro: total = (final − inicial) × fator do cliente, refeito no servidor", () => {
    const registro = montarRegistroChegada(manometro, viagem, "u1", agora)
    expect(registro).toMatchObject({ km: 152410, medicao: "MANOMETRO", fator: 131.92, usuarioId: "u1", polInicial: null, polFinal: null })
    expect(registro.totalDescarregado).toBeCloseTo((250 - 122) * 131.92, 2)
  })

  it("pol só fica gravado no biometano", () => {
    const comPol = { ...manometro, polInicial: 30, polFinal: 10 }
    expect(montarRegistroChegada(comPol, viagem, null, agora)).toMatchObject({ polInicial: null, polFinal: null })

    const bio = { ...comPol, medicao: "BALANCA" as const, nivelInicial: 900, nivelFinal: 300, fatorCliente: null }
    const registro = montarRegistroChegada(bio, { ...viagem, produto: "BIOMETANO" }, null, agora)
    expect(registro).toMatchObject({ polInicial: 30, polFinal: 10, totalDescarregado: 600 })
  })

  it("recusa km abaixo do inicial, hora antes da saída ou no futuro e leitura impossível", () => {
    expect(() => montarRegistroChegada({ ...manometro, km: 152000 }, viagem, null, agora)).toThrow("menor que o km inicial")
    expect(() => montarRegistroChegada({ ...manometro, chegadaEm: h("2026-10-02T06:00:00") }, viagem, null, agora)).toThrow(
      "antes da saída",
    )
    expect(() => montarRegistroChegada({ ...manometro, chegadaEm: h("2026-10-03T09:00:00") }, viagem, null, agora)).toThrow("no futuro")
    expect(() => montarRegistroChegada({ ...manometro, fatorCliente: null }, viagem, null, agora)).toThrow()
  })
})
