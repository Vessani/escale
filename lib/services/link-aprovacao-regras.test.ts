import { describe, expect, it } from "vitest"
import type { StatusViagem } from "@prisma/client"
import { frotaDaViagem, linhasDaViagem, viagemSugerida } from "./link-aprovacao-regras"

describe("frota da viagem no pedido", () => {
  it("cavalo e carreta, pulando o placeholder do truck e campo vazio", () => {
    expect(frotaDaViagem({ cavalo: "ABC1D23", carreta: "DEF4G56" })).toBe("ABC1D23 / DEF4G56")
    expect(frotaDaViagem({ cavalo: "0000", carreta: "DEF4G56" })).toBe("DEF4G56")
    expect(frotaDaViagem({ cavalo: "", carreta: " " })).toBeNull()
  })

  it("linha da viagem na mensagem do grupo", () => {
    expect(linhasDaViagem({ numViagem: "123456", cavalo: "ABC1D23", carreta: "DEF4G56" })).toEqual([
      "Viagem: 123456 · Frota ABC1D23 / DEF4G56",
    ])
    expect(linhasDaViagem({ numViagem: "123456", cavalo: "0000", carreta: "" })).toEqual(["Viagem: 123456"])
    expect(linhasDaViagem(null)).toEqual([])
  })
})

describe("viagemSugerida", () => {
  const v = (id: number, status: StatusViagem) => ({ id, status })

  it("a que está na estrada, mesmo com outras programadas", () => {
    expect(viagemSugerida([v(1, "ALOCADA"), v(2, "INICIADA"), v(3, "CRIADA")])?.id).toBe(2)
    expect(viagemSugerida([v(1, "RETORNANDO"), v(3, "ALOCADA")])?.id).toBe(1)
  })

  it("sem nenhuma na estrada, a única aberta", () => {
    expect(viagemSugerida([v(4, "ALOCADA")])?.id).toBe(4)
  })

  it("na dúvida, nenhuma: quem pede escolhe", () => {
    expect(viagemSugerida([v(1, "ALOCADA"), v(2, "CRIADA")])).toBeNull()
    expect(viagemSugerida([v(1, "INICIADA"), v(2, "RETORNANDO")])).toBeNull()
    expect(viagemSugerida([])).toBeNull()
  })
})
