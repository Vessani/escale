import { describe, expect, it, vi, beforeEach } from "vitest"
import { getServerSession } from "next-auth"

vi.mock("next-auth", () => ({
  getServerSession: vi.fn(),
}))

vi.mock("@/lib/auth", () => ({
  authOptions: {},
}))

import { requireSessaoApi } from "@/lib/api-auth"
import { NaoAutorizadoError } from "@/lib/errors"

describe("requireSessaoApi", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("lança NaoAutorizadoError sem sessão", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null)

    await expect(requireSessaoApi()).rejects.toBeInstanceOf(NaoAutorizadoError)
  })

  it("lança NaoAutorizadoError pra SUPERADMIN (sem filial — rotas expostas hoje são todas operacionais)", async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: "1", role: "SUPERADMIN", filialId: null } } as never)

    await expect(requireSessaoApi()).rejects.toBeInstanceOf(NaoAutorizadoError)
  })

  it("devolve session e filialId com sessão válida", async () => {
    const session = { user: { id: "1", role: "DESPACHANTE", filialId: 9 } }
    vi.mocked(getServerSession).mockResolvedValue(session as never)

    const resultado = await requireSessaoApi()

    expect(resultado.filialId).toBe(9)
    expect(resultado.session).toEqual(session)
  })
})
