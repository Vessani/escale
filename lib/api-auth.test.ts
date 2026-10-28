import { describe, expect, it, vi, beforeEach } from "vitest"
import { getServerSession } from "next-auth"

vi.mock("next-auth", () => ({
  getServerSession: vi.fn(),
}))

vi.mock("@/lib/auth", () => ({
  authOptions: {},
}))

vi.mock("@/lib/torre", () => ({
  filialDaTorre: vi.fn(async () => 5),
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

  it("torre (sem filial no cadastro) usa a filial escolhida no menu — as rotas são só leitura", async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: "t1", role: "TORRE", filialId: null } } as never)

    await expect(requireSessaoApi()).resolves.toMatchObject({ filialId: 5 })
  })

  it("devolve session e filialId com sessão válida", async () => {
    const session = { user: { id: "1", role: "DESPACHANTE", filialId: 9 } }
    vi.mocked(getServerSession).mockResolvedValue(session as never)

    const resultado = await requireSessaoApi()

    expect(resultado.filialId).toBe(9)
    expect(resultado.session).toEqual(session)
  })

  it("motorista não usa nenhuma rota de API (relatórios, Excel, listas)", async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: "m1", role: "MOTORISTA", filialId: 3, motoristaId: 42 } } as never)

    await expect(requireSessaoApi()).rejects.toBeInstanceOf(NaoAutorizadoError)
  })
})
