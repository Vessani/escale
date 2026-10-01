import { describe, expect, it, vi, beforeEach } from "vitest"
import { getServerSession } from "next-auth"

vi.mock("next-auth", () => ({
  getServerSession: vi.fn(),
}))

vi.mock("@/lib/auth", () => ({
  authOptions: {},
}))

vi.mock("@/lib/queries/motoristas", () => ({
  buscarMotoristasParaApi: vi.fn(),
}))

import { buscarMotoristasParaApi } from "@/lib/queries/motoristas"
import { GET } from "./route"

describe("GET /api/motoristas", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("retorna 401 sem sessão, sem consultar motoristas", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null)

    const resposta = await GET()

    expect(resposta.status).toBe(401)
    expect(buscarMotoristasParaApi).not.toHaveBeenCalled()
  })

  it("busca sempre com a filialId da sessão, e devolve { data: [...] }", async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: "1", role: "DESPACHANTE", filialId: 3 } } as never)
    vi.mocked(buscarMotoristasParaApi).mockResolvedValue([{ id: 1, nome: "Ana" }] as never)

    const resposta = await GET()

    expect(resposta.status).toBe(200)
    expect(buscarMotoristasParaApi).toHaveBeenCalledWith(3)
    expect(await resposta.json()).toEqual({ data: [{ id: 1, nome: "Ana" }] })
  })

  it("a consulta da API nunca seleciona o CPF", async () => {
    const real = await vi.importActual<typeof import("@/lib/queries/motoristas")>("@/lib/queries/motoristas")
    const { prisma } = await import("@/lib/prisma")
    const findMany = vi.spyOn(prisma.motorista, "findMany").mockResolvedValue([] as never)

    await real.buscarMotoristasParaApi(3)

    const args = findMany.mock.calls[0]?.[0]
    expect(args?.where).toMatchObject({ filialId: 3, deletadoEm: null })
    expect(args?.select).toBeDefined()
    expect(args?.select).not.toHaveProperty("cpf")
  })
})
