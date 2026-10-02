import { describe, expect, it, vi } from "vitest"
import { MENSAGEM_SEM_CONEXAO, chamarAcao } from "./chamar-acao"

describe("chamarAcao", () => {
  it("devolve a resposta da action como veio (sucesso ou erro de negócio)", async () => {
    expect(await chamarAcao(async () => ({ sucesso: true as const, pin: "123456" }))).toEqual({ sucesso: true, pin: "123456" })
    expect(await chamarAcao(async () => ({ sucesso: false as const, erro: "Km inválido." }))).toEqual({ sucesso: false, erro: "Km inválido." })
  })

  it("sem conexão (a chamada lança): vira mensagem na tela em vez de derrubar a página", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {})
    expect(await chamarAcao(async () => Promise.reject(new TypeError("Failed to fetch")))).toEqual({ sucesso: false, erro: MENSAGEM_SEM_CONEXAO })
  })
})
