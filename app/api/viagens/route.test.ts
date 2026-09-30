import { describe, expect, it, vi, beforeEach } from "vitest"
import { getServerSession } from "next-auth"

vi.mock("next-auth", () => ({
  getServerSession: vi.fn(),
}))

vi.mock("@/lib/auth", () => ({
  authOptions: {},
}))

vi.mock("@/lib/queries/viagens", () => ({
  buscarViagensPaginadas: vi.fn(),
}))

import { buscarViagensPaginadas } from "@/lib/queries/viagens"
import { GET } from "./route"

describe("GET /api/viagens", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("retorna 401 sem sessão, sem consultar viagens", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null)

    const resposta = await GET(new Request("http://localhost/api/viagens?status=CRIADA&pagina=2"))

    expect(resposta.status).toBe(401)
    expect(buscarViagensPaginadas).not.toHaveBeenCalled()
  })

  it("busca sempre com a filialId da sessão, e devolve { data: [...] }", async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: "1", role: "DESPACHANTE", filialId: 7 } } as never)
    vi.mocked(buscarViagensPaginadas).mockResolvedValue({ viagens: [{ id: 1, numViagem: "123" }], total: 51, totalPaginas: 2 } as never)

    const resposta = await GET(new Request("http://localhost/api/viagens?status=CRIADA&pagina=2"))

    expect(resposta.status).toBe(200)
    expect(buscarViagensPaginadas).toHaveBeenCalledWith(7, expect.objectContaining({ status: "CRIADA", pagina: 2 }))
    expect(await resposta.json()).toEqual({ data: { viagens: [{ id: 1, numViagem: "123" }], pagina: 2, totalPaginas: 2, total: 51 } })
  })
})
