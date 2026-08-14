import { describe, expect, it, vi, beforeEach } from "vitest"

vi.mock("@/lib/prisma", () => ({
  prisma: {
    motorista: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
    },
  },
}))

import { prisma } from "@/lib/prisma"
import {
  HORAS_FINALIZADA_RELEVANTE,
  limiteFinalizadaRelevante,
  buscarMotoristas,
  buscarMotoristaPorId,
  buscarMotoristasParaSelect,
  buscarMotoristasComAgenda,
} from "./motoristas"

const FILIAL_ID = 3

describe("limiteFinalizadaRelevante", () => {
  it("subtrai HORAS_FINALIZADA_RELEVANTE horas do instante informado", () => {
    const agora = new Date("2026-07-10T12:00:00")
    const limite = limiteFinalizadaRelevante(agora)

    expect(limite.getTime()).toBe(agora.getTime() - HORAS_FINALIZADA_RELEVANTE * 60 * 60 * 1000)
  })

  it("a margem é maior que o maior descanso legal (35h), pra não cortar uma viagem FINALIZADA ainda relevante", () => {
    expect(HORAS_FINALIZADA_RELEVANTE).toBeGreaterThan(35)
  })
})

type ViagemWhere = { OR?: Array<Record<string, unknown>> }

function filtroViagemDaChamada(where: { viagens?: { where: ViagemWhere } }) {
  return where.viagens!.where
}

describe("lib/queries/motoristas — isolamento por filial e filtro de viagem ativa", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(prisma.motorista.findMany).mockResolvedValue([] as never)
    vi.mocked(prisma.motorista.findFirst).mockResolvedValue(null as never)
  })

  it("buscarMotoristas filtra por filialId", async () => {
    await buscarMotoristas(FILIAL_ID)

    const chamada = vi.mocked(prisma.motorista.findMany).mock.calls[0][0] as { where: Record<string, unknown> }
    expect(chamada.where).toMatchObject({ filialId: FILIAL_ID, deletadoEm: null })
  })

  it("buscarMotoristas exclui CANCELADA da agenda considerada", async () => {
    await buscarMotoristas(FILIAL_ID)

    const chamada = vi.mocked(prisma.motorista.findMany).mock.calls[0][0] as { include: { viagens: { where: ViagemWhere } } }
    const filtro = filtroViagemDaChamada(chamada.include as never)
    const condicaoStatus = filtro.OR![0] as { status: { notIn: string[] } }
    expect(condicaoStatus.status.notIn).toContain("CANCELADA")
  })

  it("buscarMotoristas ainda considera FINALIZADA recente (dentro da margem de HORAS_FINALIZADA_RELEVANTE) na agenda", async () => {
    await buscarMotoristas(FILIAL_ID)

    const chamada = vi.mocked(prisma.motorista.findMany).mock.calls[0][0] as { include: { viagens: { where: ViagemWhere } } }
    const filtro = filtroViagemDaChamada(chamada.include as never)
    const condicaoFinalizada = filtro.OR!.find((c) => (c as { status?: string }).status === "FINALIZADA") as
      | { status: string; fimPrevisto: { gte: Date } }
      | undefined

    expect(condicaoFinalizada).toBeDefined()
    expect(condicaoFinalizada!.fimPrevisto.gte).toBeInstanceOf(Date)
  })

  it("buscarMotoristaPorId usa findFirst com id + filialId", async () => {
    await buscarMotoristaPorId(FILIAL_ID, 10)

    const chamada = vi.mocked(prisma.motorista.findFirst).mock.calls[0][0] as { where: Record<string, unknown> }
    expect(chamada.where).toMatchObject({ id: 10, filialId: FILIAL_ID, deletadoEm: null })
  })

  it("buscarMotoristasParaSelect filtra por filialId e, quando informado, por turno", async () => {
    await buscarMotoristasParaSelect(FILIAL_ID, "NOITE")

    const chamada = vi.mocked(prisma.motorista.findMany).mock.calls[0][0] as { where: Record<string, unknown> }
    expect(chamada.where).toMatchObject({ filialId: FILIAL_ID, deletadoEm: null, turno: "NOITE" })
  })

  it("buscarMotoristasParaSelect não filtra por turno quando ele não é informado", async () => {
    await buscarMotoristasParaSelect(FILIAL_ID)

    const chamada = vi.mocked(prisma.motorista.findMany).mock.calls[0][0] as { where: Record<string, unknown> }
    expect(chamada.where).not.toHaveProperty("turno")
  })

  it("buscarMotoristasComAgenda filtra por filialId", async () => {
    await buscarMotoristasComAgenda(FILIAL_ID, new Date("2026-08-01"), new Date("2026-08-31"))

    const chamada = vi.mocked(prisma.motorista.findMany).mock.calls[0][0] as { where: Record<string, unknown> }
    expect(chamada.where).toMatchObject({ filialId: FILIAL_ID, deletadoEm: null })
  })
})
