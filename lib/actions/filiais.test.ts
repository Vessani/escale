import { describe, expect, it, vi, beforeEach } from "vitest"
import { getServerSession } from "next-auth"

vi.mock("next-auth", () => ({
  getServerSession: vi.fn(),
}))

vi.mock("@/lib/auth", () => ({
  authOptions: {},
}))

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}))

vi.mock("@/lib/prisma", () => ({
  prisma: {
    filial: {
      create: vi.fn(),
    },
  },
}))

import { prisma } from "@/lib/prisma"
import { criarFilial } from "@/lib/actions/filiais"

const filialValida = { nome: "Filial Joinville" }

describe("lib/actions/filiais — controle de acesso", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("recusa sem sessão e não chama o prisma", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null)

    const resposta = await criarFilial(filialValida)

    expect(resposta).toEqual({ sucesso: false, erro: "Não autorizado." })
    expect(prisma.filial.create).not.toHaveBeenCalled()
  })

  it("recusa para ADMIN — criar filial é exclusivo de SUPERADMIN", async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: "1", role: "ADMIN", filialId: 1 } } as never)

    const resposta = await criarFilial(filialValida)

    expect(resposta).toEqual({ sucesso: false, erro: "Não autorizado." })
    expect(prisma.filial.create).not.toHaveBeenCalled()
  })

  it("recusa para DESPACHANTE", async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: "1", role: "DESPACHANTE", filialId: 1 } } as never)

    const resposta = await criarFilial(filialValida)

    expect(resposta.sucesso).toBe(false)
    expect(prisma.filial.create).not.toHaveBeenCalled()
  })

  describe("com sessão de SUPERADMIN", () => {
    beforeEach(() => {
      vi.mocked(getServerSession).mockResolvedValue({ user: { id: "1", role: "SUPERADMIN", filialId: null } } as never)
    })

    it("cria a filial com o nome validado", async () => {
      vi.mocked(prisma.filial.create).mockResolvedValue({} as never)

      const resposta = await criarFilial(filialValida)

      expect(resposta).toEqual({ sucesso: true })
      expect(prisma.filial.create).toHaveBeenCalledWith({ data: filialValida })
    })

    it("recusa nome vazio e não chama o prisma", async () => {
      const resposta = await criarFilial({ nome: "" })

      expect(resposta.sucesso).toBe(false)
      expect(prisma.filial.create).not.toHaveBeenCalled()
    })
  })
})
