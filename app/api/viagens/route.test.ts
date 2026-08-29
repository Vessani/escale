import { describe, expect, it, vi, beforeEach } from "vitest"
import { getServerSession } from "next-auth"

vi.mock("next-auth", () => ({
  getServerSession: vi.fn(),
}))

vi.mock("@/lib/auth", () => ({
  authOptions: {},
}))

vi.mock("@/lib/queries/viagens", () => ({
  buscarViagens: vi.fn(),
}))

import { buscarViagens } from "@/lib/queries/viagens"
import { GET } from "./route"

describe("GET /api/viagens", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("retorna 401 sem sessão, sem consultar viagens", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null)

    const resposta = await GET()

    expect(resposta.status).toBe(401)
    expect(buscarViagens).not.toHaveBeenCalled()
  })

  it("busca sempre com a filialId da sessão, e devolve { data: [...] }", async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: "1", role: "DESPACHANTE", filialId: 7 } } as never)
    vi.mocked(buscarViagens).mockResolvedValue([{ id: 1, numViagem: "123" }] as never)

    const resposta = await GET()

    expect(resposta.status).toBe(200)
    expect(buscarViagens).toHaveBeenCalledWith(7)
    expect(await resposta.json()).toEqual({ data: [{ id: 1, numViagem: "123" }] })
  })
})
