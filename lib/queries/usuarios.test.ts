import { describe, expect, it, vi, beforeEach } from "vitest"

vi.mock("@/lib/prisma", () => ({
  prisma: {
    usuario: {
      findMany: vi.fn(),
    },
  },
}))

import { prisma } from "@/lib/prisma"
import { buscarUsuarios } from "@/lib/queries/usuarios"

describe("lib/queries/usuarios", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("busca todos os usuários (visão do SUPERADMIN) sem incluir a senha no select", async () => {
    vi.mocked(prisma.usuario.findMany).mockResolvedValue([] as never)

    await buscarUsuarios()

    const chamada = vi.mocked(prisma.usuario.findMany).mock.calls[0][0] as { select: Record<string, unknown> }
    expect(chamada.select).not.toHaveProperty("senha")
    expect(chamada.select).toMatchObject({ id: true, nome: true, email: true, role: true, filialId: true })
  })
})
