import { describe, expect, it } from "vitest"
import { formatarNomeProprio, paradasDaRota } from "./texto"

describe("formatarNomeProprio", () => {
  it.each([
    ["FRANCINEI PAULINO", "Francinei Paulino"],
    ["RIO DO SUL", "Rio do Sul"],
    ["RIBAS DO RIO PARDO", "Ribas do Rio Pardo"],
    ["  joinville ", "Joinville"],
    ["SÃO JOSÉ DOS PINHAIS", "São José dos Pinhais"],
  ])("%s -> %s", (entrada, esperado) => {
    expect(formatarNomeProprio(entrada)).toBe(esperado)
  })
})

describe("paradasDaRota", () => {
  it("formata, ignora vazias e junta paradas repetidas em sequência", () => {
    expect(paradasDaRota(["JOINVILLE", "ITAJAI", "ITAJAI", "", null, "BLUMENAU", "JOINVILLE"])).toEqual([
      "Joinville",
      "Itajai",
      "Blumenau",
      "Joinville",
    ])
  })
})
