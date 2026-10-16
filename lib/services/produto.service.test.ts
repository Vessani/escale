import { describe, expect, it } from "vitest"
import { PRODUTO_OPCOES, ehTipoProduto, formatarProduto, motoristasSemProdutoAutorizado, produtoPeloNome } from "./produto.service"

describe("produto.service", () => {
  it("rótulos e checagem dos produtos", () => {
    expect(PRODUTO_OPCOES.map((p) => p.valor)).toEqual(["CO2", "NITROGENIO", "ARGONIO", "BIOMETANO", "OXIGENIO"])
    expect(formatarProduto("CO2")).toBe("Carbono")
    expect(formatarProduto(null)).toBe("Não informado")
    expect(ehTipoProduto("ARGONIO")).toBe(true)
    expect(ehTipoProduto("HELIO")).toBe(false)
  })
})

describe("produtoPeloNome (título da planilha de programação)", () => {
  it("reconhece o produto com ou sem acento, em qualquer caixa", () => {
    expect(produtoPeloNome("Oxigênio (Sul)")).toBe("OXIGENIO")
    expect(produtoPeloNome("Nitrogênio (Sul)")).toBe("NITROGENIO")
    expect(produtoPeloNome("ARGONIO (SUL)")).toBe("ARGONIO")
    expect(produtoPeloNome("Biometano")).toBe("BIOMETANO")
    expect(produtoPeloNome("CO2 (Sul)")).toBe("CO2")
  })

  it("Oxigênio Laser e Ultra Puro usam a frota do oxigênio", () => {
    expect(produtoPeloNome("Oxigênio Laser (Sul)")).toBe("OXIGENIO")
    expect(produtoPeloNome("Oxigênio Ultra Puro (Sul)")).toBe("OXIGENIO")
  })

  it("tolera erro de digitação no fim do nome", () => {
    expect(produtoPeloNome("Argononio (Sul)")).toBe("ARGONIO")
  })

  it("sem produto, ou com mais de um no mesmo texto, não adivinha", () => {
    expect(produtoPeloNome("Resumo de viagem de 16.10.2026 a 16.10.2026")).toBeNull()
    expect(produtoPeloNome("CDL: JOINVILLE")).toBeNull()
    expect(produtoPeloNome("Oxigênio e Nitrogênio")).toBeNull()
  })
})

describe("motoristasSemProdutoAutorizado", () => {
  const motorista = (
    nome: string,
    tipo: "MOTORISTA" | "INSTRUTOR" | "TREINAMENTO" | "ENCHEDOR",
    produtos: Array<"CO2" | "OXIGENIO"> = [],
  ) => ({
    nome,
    tipo,
    produtosAutorizados: produtos,
  })

  it("lista quem viaja e não tem nenhum produto, em ordem alfabética", () => {
    const lista = motoristasSemProdutoAutorizado([
      motorista("ZECA", "MOTORISTA"),
      motorista("ÁLVARO", "TREINAMENTO"),
      motorista("BIA", "MOTORISTA", ["OXIGENIO"]),
      motorista("CAIO", "INSTRUTOR"),
    ])
    expect(lista.map((m) => m.nome)).toEqual(["ÁLVARO", "CAIO", "ZECA"])
  })

  it("enchedor não viaja, então não precisa de produto", () => {
    expect(motoristasSemProdutoAutorizado([motorista("DUDA", "ENCHEDOR")])).toEqual([])
  })
})
