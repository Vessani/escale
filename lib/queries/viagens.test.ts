import { describe, expect, it, vi, beforeEach } from "vitest"

vi.mock("@/lib/prisma", () => ({
  prisma: {
    viagem: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      count: vi.fn(),
    },
  },
}))

import { prisma } from "@/lib/prisma"
import { buscarViagensPaginadas, buscarViagemPorId, buscarViagensSemMotorista, buscarViagensDoDashboard } from "@/lib/queries/viagens"

const FILIAL_ID = 3
const OUTRA_FILIAL_ID = 7

describe("lib/queries/viagens — isolamento por filial", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(prisma.viagem.findMany).mockResolvedValue([] as never)
    vi.mocked(prisma.viagem.findFirst).mockResolvedValue(null as never)
  })

  it("buscarViagensPaginadas filtra por filialId, ignora deletadas, pagina e não traz entregas", async () => {
    await buscarViagensPaginadas(FILIAL_ID, {
      status: "TODOS",
      de: new Date("2026-09-23T03:00:00Z"),
      ate: new Date("2026-10-30T03:00:00Z"),
      busca: "",
      pagina: 3,
    })

    const chamada = vi.mocked(prisma.viagem.findMany).mock.calls[0][0] as {
      where: Record<string, unknown>
      skip: number
      take: number
      select: Record<string, unknown>
    }
    expect(chamada.where).toMatchObject({ filialId: FILIAL_ID, deletadoEm: null })
    expect(chamada.where).toHaveProperty("inicioPrevisto")
    expect(chamada.skip).toBe(100)
    expect(chamada.take).toBe(50)
    expect(chamada.select).not.toHaveProperty("entregas")
    expect(prisma.viagem.count).toHaveBeenCalledWith({ where: chamada.where })
  })

  it("buscarViagensPaginadas com busca por número ignora o período", async () => {
    await buscarViagensPaginadas(FILIAL_ID, { status: "TODOS", de: new Date(), ate: new Date(), busca: "9220", pagina: 1 })

    const chamada = vi.mocked(prisma.viagem.findMany).mock.calls[0][0] as { where: Record<string, unknown> }
    expect(chamada.where).toMatchObject({ numViagem: { contains: "9220", mode: "insensitive" } })
    expect(chamada.where).not.toHaveProperty("inicioPrevisto")
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

  it("buscarViagensDoDashboard filtra por filialId e traz todos os status (inclusive Finalizadas do dia)", async () => {
    await buscarViagensDoDashboard(FILIAL_ID, new Date("2026-08-13T12:00:00"))

    const chamada = vi.mocked(prisma.viagem.findMany).mock.calls[0][0] as {
      where: Record<string, unknown> & { OR: Array<Record<string, unknown>> }
    }
    expect(chamada.where).toMatchObject({ filialId: FILIAL_ID, deletadoEm: null })
    // Sem filtro de status no banco — o filtro e as contagens saem da mesma lista, na página.
    expect(chamada.where).not.toHaveProperty("status")
    expect(chamada.where.OR).toContainEqual(expect.objectContaining({ status: "FINALIZADA" }))
    // Em andamento de dias anteriores (qualquer fim previsto) e as que não saíram quando deviam.
    expect(chamada.where.OR).toContainEqual({ status: { in: ["INICIADA", "RETORNANDO"] }, inicioPrevisto: { lte: expect.any(Date) } })
    const naoSaiu = chamada.where.OR.find((filtro) => JSON.stringify(filtro.status ?? null).includes("ALOCADA")) as {
      inicioPrevisto: { gte: Date; lt: Date }
    }
    expect((naoSaiu.inicioPrevisto.lt.getTime() - naoSaiu.inicioPrevisto.gte.getTime()) / 86_400_000).toBe(30)
  })

  it("buscarViagensDoDashboard nunca mistura filialId de duas chamadas diferentes", async () => {
    await buscarViagensDoDashboard(FILIAL_ID, new Date("2026-08-13T12:00:00"))
    await buscarViagensDoDashboard(OUTRA_FILIAL_ID, new Date("2026-08-13T12:00:00"))

    const chamadas = vi.mocked(prisma.viagem.findMany).mock.calls as Array<[{ where: Record<string, unknown> }]>
    expect(chamadas[0][0].where.filialId).toBe(FILIAL_ID)
    expect(chamadas[1][0].where.filialId).toBe(OUTRA_FILIAL_ID)
  })
})
