import { describe, expect, it, vi } from "vitest"
import { MENSAGEM_ERRO_INESPERADO, MENSAGEM_SEM_CONEXAO, MENSAGEM_SISTEMA_ATUALIZADO, chamarAcao, mensagemDaFalha } from "./chamar-acao"

describe("chamarAcao", () => {
  it("devolve a resposta da action como veio (sucesso ou erro de negócio)", async () => {
    expect(await chamarAcao(async () => ({ sucesso: true as const, pin: "123456" }))).toEqual({ sucesso: true, pin: "123456" })
    expect(await chamarAcao(async () => ({ sucesso: false as const, erro: "Km inválido." }))).toEqual({ sucesso: false, erro: "Km inválido." })
  })

  it("se a chamada lança, vira mensagem na tela em vez de derrubar a página", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {})
    expect(await chamarAcao(async () => Promise.reject(new TypeError("Failed to fetch")))).toEqual({ sucesso: false, erro: MENSAGEM_SEM_CONEXAO })
  })
})

describe("mensagemDaFalha", () => {
  it("rede caiu (Chrome, Firefox, Safari) → sem conexão", () => {
    expect(mensagemDaFalha(new TypeError("Failed to fetch"))).toBe(MENSAGEM_SEM_CONEXAO)
    expect(mensagemDaFalha(new Error("NetworkError when attempting to fetch resource."))).toBe(MENSAGEM_SEM_CONEXAO)
    expect(mensagemDaFalha(new TypeError("Load failed"))).toBe(MENSAGEM_SEM_CONEXAO)
  })

  it("tela aberta antes de um deploy → recarregar (não 'sem conexão')", () => {
    expect(mensagemDaFalha(new Error('Failed to find Server Action "7f3a". This request might be from an older or newer deployment.'))).toBe(
      MENSAGEM_SISTEMA_ATUALIZADO,
    )
  })

  it("qualquer outra falha (inclusive bug que também é TypeError) → recarregar", () => {
    expect(mensagemDaFalha(new Error("Unexpected token < in JSON"))).toBe(MENSAGEM_ERRO_INESPERADO)
    expect(mensagemDaFalha(new TypeError("Cannot read properties of undefined (reading 'id')"))).toBe(MENSAGEM_ERRO_INESPERADO)
  })
})
