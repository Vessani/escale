import { describe, expect, it, vi, beforeEach } from "vitest"

vi.mock("@/lib/prisma", () => ({
  prisma: {
    cliente: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
    },
  },
}))

import { prisma } from "@/lib/prisma"
import { buscarClientes, buscarClientePorId, buscarClientesQueExigemIntegracaoPorNome } from "@/lib/queries/clientes"

describe("lib/queries/clientes", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("buscarClientes é global — não filtra por filial, só ignora deletados (cliente é compartilhado entre filiais)", async () => {
    vi.mocked(prisma.cliente.findMany).mockResolvedValue([] as never)

    await buscarClientes()

    expect(prisma.cliente.findMany).toHaveBeenCalledWith({
      where: { deletadoEm: null },
      orderBy: { nome: "asc" },
    })
  })

  it("buscarClientePorId ignora deletados", async () => {
    vi.mocked(prisma.cliente.findFirst).mockResolvedValue(null as never)

    await buscarClientePorId(9)

    expect(prisma.cliente.findFirst).toHaveBeenCalledWith({ where: { id: 9, deletadoEm: null } })
  })

  it("buscarClientesQueExigemIntegracaoPorNome normaliza nome (trim + maiúsculas), mapeia pro numeroSap e filtra só exigeIntegracao: true", async () => {
    vi.mocked(prisma.cliente.findMany).mockResolvedValue([
      { nome: "  weg  ", numeroSap: "4521087" },
      { nome: "Gemp - Ambev", numeroSap: "9981234" },
    ] as never)

    const resultado = await buscarClientesQueExigemIntegracaoPorNome()

    expect(prisma.cliente.findMany).toHaveBeenCalledWith({
      where: { deletadoEm: null, exigeIntegracao: true },
      select: { nome: true, numeroSap: true },
    })
    expect(resultado).toEqual(new Map([["WEG", "4521087"], ["GEMP - AMBEV", "9981234"]]))
  })

  it("buscarClientesQueExigemIntegracaoPorNome retorna um Map vazio quando nenhum cliente exige integração", async () => {
    vi.mocked(prisma.cliente.findMany).mockResolvedValue([] as never)

    const resultado = await buscarClientesQueExigemIntegracaoPorNome()

    expect(resultado.size).toBe(0)
  })
})
