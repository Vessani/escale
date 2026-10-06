import { describe, expect, it, vi, beforeEach } from "vitest"
import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import {
  requireSession,
  requireSessionComFilial,
  requireSessaoPagina,
  requireSessaoPaginaComFilial,
  requireSessaoMotorista,
} from "@/lib/auth-guard"

vi.mock("next-auth", () => ({
  getServerSession: vi.fn(),
}))

// redirect() do Next lança pra interromper a renderização — o mock imita isso.
vi.mock("next/navigation", () => ({
  redirect: vi.fn((destino: string) => {
    throw new Error(`REDIRECT:${destino}`)
  }),
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

describe("requireSessaoPagina / requireSessaoPaginaComFilial", () => {
  beforeEach(() => {
    vi.mocked(getServerSession).mockReset()
    vi.mocked(redirect).mockClear()
  })

  it("manda pro login quando não há sessão", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null)

    await expect(requireSessaoPagina()).rejects.toThrow("REDIRECT:/login")
  })

  it("manda pra home quando o papel não é permitido", async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { role: "DESPACHANTE" } } as never)

    await expect(requireSessaoPagina(["SUPERADMIN"])).rejects.toThrow("REDIRECT:/")
  })

  it("retorna a sessão quando o papel é permitido", async () => {
    const sessao = { user: { role: "SUPERADMIN", filialId: null } }
    vi.mocked(getServerSession).mockResolvedValue(sessao as never)

    await expect(requireSessaoPagina(["SUPERADMIN"])).resolves.toEqual(sessao)
  })

  it("manda SUPERADMIN (sem filial) pra área administrativa nas telas operacionais", async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { role: "SUPERADMIN", filialId: null } } as never)

    await expect(requireSessaoPaginaComFilial()).rejects.toThrow("REDIRECT:/admin/filiais")
  })

  it("devolve sessão e filialId quando há filial", async () => {
    const sessao = { user: { role: "DESPACHANTE", filialId: 3 } }
    vi.mocked(getServerSession).mockResolvedValue(sessao as never)

    await expect(requireSessaoPaginaComFilial()).resolves.toEqual({ session: sessao, filialId: 3 })
  })

  describe("perfil MOTORISTA", () => {
    const motorista = { user: { id: "m1", role: "MOTORISTA", filialId: 3, motoristaId: 42 } }

    it("é barrado em toda action/página que não libera MOTORISTA de propósito", async () => {
      vi.mocked(getServerSession).mockResolvedValue(motorista as never)

      await expect(requireSession()).rejects.toThrow("Não autorizado.")
      await expect(requireSessionComFilial()).rejects.toThrow("Não autorizado.")
      await expect(requireSessionComFilial(["ADMIN"])).rejects.toThrow("Não autorizado.")
      await expect(requireSessaoPagina()).rejects.toThrow("REDIRECT:/minhas-viagens")
      await expect(requireSessaoPaginaComFilial()).rejects.toThrow("REDIRECT:/minhas-viagens")
    })

    it("requireSessaoMotorista devolve o motorista do acesso; outros papéis não passam", async () => {
      vi.mocked(getServerSession).mockResolvedValue(motorista as never)
      await expect(requireSessaoMotorista()).resolves.toMatchObject({ filialId: 3, motoristaId: 42 })

      vi.mocked(getServerSession).mockResolvedValue({ user: { id: "1", role: "DESPACHANTE", filialId: 3 } } as never)
      await expect(requireSessaoMotorista()).rejects.toThrow("Não autorizado.")

      vi.mocked(getServerSession).mockResolvedValue({ user: { id: "m2", role: "MOTORISTA", filialId: 3, motoristaId: null } } as never)
      await expect(requireSessaoMotorista()).rejects.toThrow("Não autorizado.")
    })
  })
})
