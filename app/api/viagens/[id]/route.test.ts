import { describe, expect, it, vi, beforeEach } from "vitest"
import { getServerSession } from "next-auth"

vi.mock("next-auth", () => ({
  getServerSession: vi.fn(),
}))

vi.mock("@/lib/auth", () => ({
  authOptions: {},
}))

vi.mock("@/lib/queries/viagens", () => ({
  buscarViagemPorId: vi.fn(),
}))

import { buscarViagemPorId } from "@/lib/queries/viagens"
import { GET } from "./route"

function contexto(id: string) {
  return { params: Promise.resolve({ id }) }
}

describe("GET /api/viagens/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("retorna 401 sem sessão, sem consultar a viagem", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null)

    const resposta = await GET(new Request("http://x/api/viagens/42"), contexto("42"))

    expect(resposta.status).toBe(401)
    expect(buscarViagemPorId).not.toHaveBeenCalled()
  })

  it("retorna 404 pra id que não é um número inteiro", async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: "1", role: "DESPACHANTE", filialId: 1 } } as never)

    const resposta = await GET(new Request("http://x/api/viagens/abc"), contexto("abc"))

    expect(resposta.status).toBe(404)
    expect(buscarViagemPorId).not.toHaveBeenCalled()
  })

  it("retorna 404 quando a viagem não existe na filial do usuário — nunca revela que existe noutra filial", async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: "1", role: "DESPACHANTE", filialId: 1 } } as never)
    vi.mocked(buscarViagemPorId).mockResolvedValue(null as never)

    const resposta = await GET(new Request("http://x/api/viagens/42"), contexto("42"))

    expect(resposta.status).toBe(404)
    expect(buscarViagemPorId).toHaveBeenCalledWith(1, 42)
    expect(await resposta.json()).toEqual({ erro: "Viagem não encontrada." })
  })

  it("devolve 200 com { data: viagem } quando encontrada na filial da sessão", async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: "1", role: "DESPACHANTE", filialId: 9 } } as never)
    vi.mocked(buscarViagemPorId).mockResolvedValue({ id: 42, numViagem: "904527" } as never)

    const resposta = await GET(new Request("http://x/api/viagens/42"), contexto("42"))

    expect(resposta.status).toBe(200)
    expect(buscarViagemPorId).toHaveBeenCalledWith(9, 42)
    expect(await resposta.json()).toEqual({ data: { id: 42, numViagem: "904527" } })
  })
})
