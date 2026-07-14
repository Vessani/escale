import { describe, expect, it, vi, beforeEach } from "vitest"
import { getServerSession } from "next-auth"
import { requireSession } from "@/lib/auth-guard"

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
})
