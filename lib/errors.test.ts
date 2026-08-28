import { describe, expect, it } from "vitest"
import {
  ErroDeDominio,
  NaoAutorizadoError,
  ViagemNaoEncontradaError,
  StatusViagemObrigatorioError,
  MotoristaProdutoNaoAutorizadoError,
  FrotaDuplicadaError,
  DataInvalidaError,
} from "@/lib/errors"

describe("ErroDeDominio", () => {
  it("é uma instância de Error de verdade (compatível com try/catch e instanceof Error)", () => {
    const erro = new NaoAutorizadoError()
    expect(erro).toBeInstanceOf(Error)
    expect(erro).toBeInstanceOf(ErroDeDominio)
  })

  it("message (herdado de Error) é igual a mensagemSegura, pra código que ainda compara por texto continuar funcionando", () => {
    const erro = new ViagemNaoEncontradaError()
    expect(erro.message).toBe(erro.mensagemSegura)
  })
})

describe("subclasses — código estável e mensagem segura de cada uma", () => {
  const casos: Array<[string, () => ErroDeDominio, string, string]> = [
    ["NaoAutorizadoError", () => new NaoAutorizadoError(), "NAO_AUTORIZADO", "Não autorizado."],
    ["ViagemNaoEncontradaError", () => new ViagemNaoEncontradaError(), "VIAGEM_NAO_ENCONTRADA", "Viagem não encontrada."],
    [
      "StatusViagemObrigatorioError",
      () => new StatusViagemObrigatorioError(),
      "STATUS_VIAGEM_OBRIGATORIO",
      "Status de viagem é obrigatório.",
    ],
    [
      "MotoristaProdutoNaoAutorizadoError",
      () => new MotoristaProdutoNaoAutorizadoError(),
      "MOTORISTA_PRODUTO_NAO_AUTORIZADO",
      "Motorista não autorizado a carregar o produto desta viagem.",
    ],
    [
      "FrotaDuplicadaError",
      () => new FrotaDuplicadaError(),
      "FROTA_DUPLICADA",
      "Já existe um conjunto cadastrado com essa frota (cavalo/carreta).",
    ],
    ["DataInvalidaError", () => new DataInvalidaError(), "DATA_INVALIDA", "Data inválida."],
  ]

  it.each(casos)("%s", (_nome, criar, codigoEsperado, mensagemEsperada) => {
    const erro = criar()
    expect(erro.codigo).toBe(codigoEsperado)
    expect(erro.mensagemSegura).toBe(mensagemEsperada)
  })
})
