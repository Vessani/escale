import { describe, expect, it, vi, beforeEach } from "vitest"

vi.mock("@/lib/prisma", () => ({
  prisma: {
    viagem: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
    },
  },
}))

import { prisma } from "@/lib/prisma"
import {
  buscarViagens,
  buscarViagemPorId,
  buscarViagensSemMotorista,
  buscarViagensDoDashboard,
} from "@/lib/queries/viagens"

const FILIAL_ID = 3
const OUTRA_FILIAL_ID = 7

describe("lib/queries/viagens — isolamento por filial", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(prisma.viagem.findMany).mockResolvedValue([] as never)
    vi.mocked(prisma.viagem.findFirst).mockResolvedValue(null as never)
  })

  it("buscarViagens filtra por filialId e ignora deletadas", async () => {
    await buscarViagens(FILIAL_ID)

    const chamada = vi.mocked(prisma.viagem.findMany).mock.calls[0][0] as { where: Record<string, unknown> }
    expect(chamada.where).toMatchObject({ filialId: FILIAL_ID, deletadoEm: null })
  })

  it("buscarViagemPorId usa findFirst com id + filialId — não acha viagem de outra filial mesmo com id certo", async () => {
    await buscarViagemPorId(FILIAL_ID, 42)

    const chamada = vi.mocked(prisma.viagem.findFirst).mock.calls[0][0] as { where: Record<string, unknown> }
    expect(chamada.where).toMatchObject({ id: 42, filialId: FILIAL_ID, deletadoEm: null })
  })

  it("buscarViagemPorId nunca usa findUnique só por id (findUnique ignoraria o filialId)", async () => {
    await buscarViagemPorId(FILIAL_ID, 42)

    expect(prisma.viagem.findFirst).toHaveBeenCalledTimes(1)
  })

  it("buscarViagensSemMotorista filtra por filialId e status CRIADA", async () => {
    await buscarViagensSemMotorista(FILIAL_ID)

    const chamada = vi.mocked(prisma.viagem.findMany).mock.calls[0][0] as { where: Record<string, unknown> }
    expect(chamada.where).toMatchObject({ filialId: FILIAL_ID, deletadoEm: null, status: "CRIADA" })
  })

  it("buscarViagensDoDashboard filtra por filialId, mesmo com filtroStatus TODOS", async () => {
    await buscarViagensDoDashboard(FILIAL_ID, new Date("2026-08-13T12:00:00"), "TODOS")

    const chamada = vi.mocked(prisma.viagem.findMany).mock.calls[0][0] as { where: Record<string, unknown> }
    expect(chamada.where).toMatchObject({ filialId: FILIAL_ID, deletadoEm: null })
  })

  it("buscarViagensDoDashboard nunca mistura filialId de duas chamadas diferentes", async () => {
    await buscarViagensDoDashboard(FILIAL_ID, new Date("2026-08-13T12:00:00"), "TODOS")
    await buscarViagensDoDashboard(OUTRA_FILIAL_ID, new Date("2026-08-13T12:00:00"), "TODOS")

    const chamadas = vi.mocked(prisma.viagem.findMany).mock.calls as Array<[{ where: Record<string, unknown> }]>
    expect(chamadas[0][0].where.filialId).toBe(FILIAL_ID)
    expect(chamadas[1][0].where.filialId).toBe(OUTRA_FILIAL_ID)
  })
})
