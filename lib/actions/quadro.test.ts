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
    quadroObservacao: {
      upsert: vi.fn(),
    },
  },
}))

import { prisma } from "@/lib/prisma"
import { atualizarObservacoes } from "@/lib/actions/quadro"

describe("lib/actions/quadro — atualizarObservacoes", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("recusa sem sessão e não chama o prisma", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null)

    const resposta = await atualizarObservacoes("novo texto")

    expect(resposta.sucesso).toBe(false)
    expect(prisma.quadroObservacao.upsert).not.toHaveBeenCalled()
  })

  it("recusa SUPERADMIN — não tem filial pra ter quadro de observações", async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: "1", role: "SUPERADMIN", filialId: null } } as never)

    const resposta = await atualizarObservacoes("novo texto")

    expect(resposta.sucesso).toBe(false)
    expect(prisma.quadroObservacao.upsert).not.toHaveBeenCalled()
  })

  it("faz upsert do quadro da filial do usuário logado", async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: "1", role: "DESPACHANTE", filialId: 3 } } as never)
    vi.mocked(prisma.quadroObservacao.upsert).mockResolvedValue({} as never)

    const resposta = await atualizarObservacoes("aviso importante")

    expect(resposta).toEqual({ sucesso: true })
    expect(prisma.quadroObservacao.upsert).toHaveBeenCalledWith({
      where: { filialId: 3 },
      create: { filialId: 3, texto: "aviso importante" },
      update: { texto: "aviso importante" },
    })
  })

  it("propaga mensagem amigável quando o prisma falha", async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: "1", role: "DESPACHANTE", filialId: 3 } } as never)
    vi.mocked(prisma.quadroObservacao.upsert).mockRejectedValue(new Error("boom"))

    const resposta = await atualizarObservacoes("texto")

    expect(resposta.sucesso).toBe(false)
    expect(resposta.erro).toBeTruthy()
  })
})
