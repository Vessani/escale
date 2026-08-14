import { describe, expect, it, vi, beforeEach } from "vitest"

vi.mock("@/lib/prisma", () => ({
  prisma: {
    frota: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
    },
  },
}))

import { prisma } from "@/lib/prisma"
import { buscarFrotas, buscarFrotaPorId } from "@/lib/queries/frotas"

const FILIAL_ID = 5

describe("lib/queries/frotas — isolamento por filial", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(prisma.frota.findMany).mockResolvedValue([] as never)
    vi.mocked(prisma.frota.findFirst).mockResolvedValue(null as never)
  })

  it("buscarFrotas filtra por filialId e ignora deletadas", async () => {
    await buscarFrotas(FILIAL_ID)

    const chamada = vi.mocked(prisma.frota.findMany).mock.calls[0][0] as { where: Record<string, unknown> }
    expect(chamada.where).toEqual({ deletadoEm: null, filialId: FILIAL_ID })
  })

  it("buscarFrotaPorId usa findFirst com id + filialId (não vaza pra outra filial mesmo com id certo)", async () => {
    await buscarFrotaPorId(FILIAL_ID, 20)

    expect(prisma.frota.findFirst).toHaveBeenCalledWith({
      where: { id: 20, filialId: FILIAL_ID, deletadoEm: null },
    })
  })
})
