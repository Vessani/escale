import { describe, expect, it, vi, beforeEach } from "vitest"

vi.mock("@/lib/prisma", () => ({
  prisma: {
    quadroObservacao: {
      findUnique: vi.fn(),
    },
  },
}))

import { prisma } from "@/lib/prisma"
import { buscarQuadroObservacoes } from "@/lib/queries/quadro"

const FILIAL_ID = 4

describe("lib/queries/quadro — buscarQuadroObservacoes", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("busca o quadro pela filialId (um bloco por filial, não mais o singleton id: 1)", async () => {
    vi.mocked(prisma.quadroObservacao.findUnique).mockResolvedValue({ texto: "aviso da filial" } as never)

    const resultado = await buscarQuadroObservacoes(FILIAL_ID)

    expect(prisma.quadroObservacao.findUnique).toHaveBeenCalledWith({ where: { filialId: FILIAL_ID } })
    expect(resultado).toBe("aviso da filial")
  })

  it("retorna string vazia quando a filial ainda não tem quadro cadastrado", async () => {
    vi.mocked(prisma.quadroObservacao.findUnique).mockResolvedValue(null as never)

    const resultado = await buscarQuadroObservacoes(FILIAL_ID)

    expect(resultado).toBe("")
  })
})
