import { describe, expect, it, vi, beforeEach } from "vitest"

vi.mock("@/lib/prisma", () => ({
  prisma: {
    filial: {
      findMany: vi.fn(),
    },
  },
}))

import { prisma } from "@/lib/prisma"
import { buscarFiliais } from "@/lib/queries/filiais"

describe("lib/queries/filiais", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("busca todas as filiais ordenadas por nome (é o SUPERADMIN quem enxerga a lista inteira, por design)", async () => {
    vi.mocked(prisma.filial.findMany).mockResolvedValue([] as never)

    await buscarFiliais()

    expect(prisma.filial.findMany).toHaveBeenCalledWith({ orderBy: { nome: "asc" } })
  })
})
