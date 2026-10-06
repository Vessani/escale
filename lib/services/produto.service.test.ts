import { describe, expect, it } from "vitest"
import { PRODUTO_OPCOES, ehTipoProduto, formatarProduto } from "./produto.service"

describe("produto.service", () => {
  it("rótulos e checagem dos produtos", () => {
    expect(PRODUTO_OPCOES.map((p) => p.valor)).toEqual(["CO2", "NITROGENIO", "ARGONIO", "BIOMETANO", "OXIGENIO"])
    expect(formatarProduto("CO2")).toBe("Carbono")
    expect(formatarProduto(null)).toBe("Não informado")
    expect(ehTipoProduto("ARGONIO")).toBe(true)
    expect(ehTipoProduto("HELIO")).toBe(false)
  })
})
