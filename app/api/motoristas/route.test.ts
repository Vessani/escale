import { describe, expect, it, vi, beforeEach } from "vitest"
import { getServerSession } from "next-auth"

vi.mock("next-auth", () => ({
  getServerSession: vi.fn(),
}))

vi.mock("@/lib/auth", () => ({
  authOptions: {},
}))

vi.mock("@/lib/queries/motoristas", () => ({
  buscarMotoristas: vi.fn(),
}))

import { buscarMotoristas } from "@/lib/queries/motoristas"
import { GET } from "./route"

describe("GET /api/motoristas", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("retorna 401 sem sessão, sem consultar motoristas", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null)

    const resposta = await GET()

    expect(resposta.status).toBe(401)
    expect(buscarMotoristas).not.toHaveBeenCalled()
  })

  it("busca sempre com a filialId da sessão, e devolve { data: [...] }", async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: "1", role: "DESPACHANTE", filialId: 3 } } as never)
    vi.mocked(buscarMotoristas).mockResolvedValue([{ id: 1, nome: "Ana" }] as never)

    const resposta = await GET()

    expect(resposta.status).toBe(200)
    expect(buscarMotoristas).toHaveBeenCalledWith(3)
    expect(await resposta.json()).toEqual({ data: [{ id: 1, nome: "Ana" }] })
  })
})
