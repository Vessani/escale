import { describe, expect, it, vi, beforeEach } from "vitest"
import { getServerSession } from "next-auth"
import { requireSession, requireSessionComFilial } from "@/lib/auth-guard"

vi.mock("next-auth", () => ({
  getServerSession: vi.fn(),
}))

vi.mock("@/lib/auth", () => ({
  authOptions: {},
}))

describe("auth-guard", () => {
  beforeEach(() => {
    vi.mocked(getServerSession).mockReset()
  })

  it("lança 'Não autorizado.' quando não há sessão", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null)

    await expect(requireSession()).rejects.toThrow("Não autorizado.")
  })

  it("retorna a sessão quando ela existe", async () => {
    const sessao = { user: { id: "1", name: "Ana" } }
    vi.mocked(getServerSession).mockResolvedValue(sessao as never)

    await expect(requireSession()).resolves.toEqual(sessao)
  })

  it("retorna a sessão quando o role está entre os permitidos", async () => {
    const sessao = { user: { id: "1", name: "Ana", role: "ADMIN" } }
    vi.mocked(getServerSession).mockResolvedValue(sessao as never)

    await expect(requireSession(["ADMIN"])).resolves.toEqual(sessao)
  })

  it("lança 'Não autorizado.' quando o role não está entre os permitidos", async () => {
    const sessao = { user: { id: "1", name: "Ana", role: "DESPACHANTE" } }
    vi.mocked(getServerSession).mockResolvedValue(sessao as never)

    await expect(requireSession(["ADMIN"])).rejects.toThrow("Não autorizado.")
  })

  describe("requireSessionComFilial", () => {
    it("retorna a sessão e o filialId quando o usuário tem filial", async () => {
      const sessao = { user: { id: "1", name: "Ana", role: "DESPACHANTE", filialId: 7 } }
      vi.mocked(getServerSession).mockResolvedValue(sessao as never)

      await expect(requireSessionComFilial()).resolves.toEqual({ session: sessao, filialId: 7 })
    })

    it("lança 'Não autorizado.' quando o usuário não tem filial (ex: SUPERADMIN)", async () => {
      const sessao = { user: { id: "1", name: "Super", role: "SUPERADMIN", filialId: null } }
      vi.mocked(getServerSession).mockResolvedValue(sessao as never)

      await expect(requireSessionComFilial()).rejects.toThrow("Não autorizado.")
    })

    it("também aplica a checagem de role, antes da checagem de filial", async () => {
      const sessao = { user: { id: "1", name: "Ana", role: "DESPACHANTE", filialId: 7 } }
      vi.mocked(getServerSession).mockResolvedValue(sessao as never)

      await expect(requireSessionComFilial(["ADMIN"])).rejects.toThrow("Não autorizado.")
    })
  })
})
