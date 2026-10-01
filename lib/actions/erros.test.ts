import { describe, expect, it, vi, beforeEach } from "vitest"
import { getServerSession } from "next-auth"

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }))
vi.mock("@/lib/auth", () => ({ authOptions: {} }))

import { registrarErroNoNavegador } from "@/lib/actions/erros"

describe("registrarErroNoNavegador", () => {
  beforeEach(() => vi.clearAllMocks())

  it("grava no log do servidor o código mostrado na tela, a página e quem estava usando — cortando texto grande", async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: "1", email: "alan@ritmo.com" } } as never)
    const log = vi.spyOn(console, "error").mockImplementation(() => {})

    await registrarErroNoNavegador({ codigo: "K7P2QX", mensagem: "x".repeat(5000), pagina: "/", digest: "123" })

    expect(log).toHaveBeenCalledTimes(1)
    const [prefixo, json] = log.mock.calls[0] as [string, string]
    expect(prefixo).toBe("[erro-navegador]")
    const dados = JSON.parse(json)
    expect(dados).toMatchObject({ codigo: "K7P2QX", pagina: "/", digest: "123", usuario: "alan@ritmo.com" })
    expect(dados.mensagem).toHaveLength(500)
    log.mockRestore()
  })

  it("funciona sem sessão (ex: erro na tela de login) e com dados malformados", async () => {
    vi.mocked(getServerSession).mockRejectedValue(new Error("sem sessão"))
    const log = vi.spyOn(console, "error").mockImplementation(() => {})

    await registrarErroNoNavegador({ codigo: 42, mensagem: null, pagina: undefined } as never)

    expect(JSON.parse((log.mock.calls[0] as [string, string])[1])).toMatchObject({ codigo: "", mensagem: "", usuario: null })
    log.mockRestore()
  })
})
