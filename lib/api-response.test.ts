import { describe, expect, it } from "vitest"
import { respostaSucesso, respostaErro } from "@/lib/api-response"
import { NaoAutorizadoError, ViagemNaoEncontradaError, FrotaDuplicadaError } from "@/lib/errors"

describe("respostaSucesso", () => {
  it("devolve 200 com { data } por padrão", async () => {
    const resposta = respostaSucesso({ nome: "Ana" })

    expect(resposta.status).toBe(200)
    expect(resposta.headers.get("Content-Type")).toBe("application/json")
    expect(await resposta.json()).toEqual({ data: { nome: "Ana" } })
  })

  it("aceita um status customizado", async () => {
    const resposta = respostaSucesso({ ok: true }, 201)
    expect(resposta.status).toBe(201)
  })
})

describe("respostaErro", () => {
  it("NaoAutorizadoError vira 401", async () => {
    const resposta = respostaErro(new NaoAutorizadoError())
    expect(resposta.status).toBe(401)
    expect(await resposta.json()).toEqual({ erro: "Não autorizado." })
  })

  it("ViagemNaoEncontradaError vira 404", async () => {
    const resposta = respostaErro(new ViagemNaoEncontradaError())
    expect(resposta.status).toBe(404)
    expect(await resposta.json()).toEqual({ erro: "Viagem não encontrada." })
  })

  it("ErroDeDominio sem status mapeado cai em 422", async () => {
    const resposta = respostaErro(new FrotaDuplicadaError())
    expect(resposta.status).toBe(422)
  })

  it("erro comum (bug/não tipado) vira 500 com mensagem genérica, nunca vaza o texto técnico", async () => {
    const resposta = respostaErro(new TypeError("Cannot read properties of undefined"))
    expect(resposta.status).toBe(500)
    expect(await resposta.json()).toEqual({ erro: "Ocorreu um erro inesperado." })
  })
})
