import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/prisma", () => ({
  prisma: { $transaction: vi.fn(), manutencao: { findFirst: vi.fn() } },
}))
vi.mock("./frota.service", () => ({ sincronizarDisponibilidadeFrota: vi.fn() }))

import { prisma } from "@/lib/prisma"
import { sincronizarDisponibilidadeFrota } from "./frota.service"
import {
  concluirManutencaoService,
  criarManutencaoService,
  editarManutencaoService,
  excluirManutencaoService,
} from "./manutencao.service"
import type { Ator } from "./auditoria.service"

const FILIAL = 1
const ATOR: Ator = { usuarioId: "u1", usuarioNome: "Ana" }
const h = (iso: string) => new Date(`${iso}-03:00`)

function criarTx() {
  return {
    manutencao: {
      create: vi.fn(async ({ data }) => ({ id: 5, ...data })),
      update: vi.fn(async ({ data }) => ({ id: 5, veiculo: "CARRETA", codigo: "908", ...data })),
    },
    viagem: { findMany: vi.fn().mockResolvedValue([{ cavalo: "75", carreta: "908" }, { cavalo: "76", carreta: "908" }]) },
    registroAuditoria: { create: vi.fn() },
  }
}

function usarTx(tx: ReturnType<typeof criarTx>) {
  vi.mocked(prisma.$transaction).mockImplementation(((callback: (t: typeof tx) => unknown) => Promise.resolve(callback(tx))) as never)
}

const dados = {
  veiculo: "CARRETA" as const,
  codigo: " 908 ",
  tipo: "CORRETIVA" as const,
  nivel: "B" as const,
  responsavel: "RITMO" as const,
  descricao: "  troca de pneu ",
  inicioPrevisto: "2026-09-30T08:00",
  fimPrevisto: "",
}

describe("manutencao.service", () => {
  beforeEach(() => vi.clearAllMocks())

  it("cria normalizando (código, nível só na preventiva, sem fim = null), recalcula as viagens da carreta e audita", async () => {
    const tx = criarTx()
    usarTx(tx)

    await criarManutencaoService(FILIAL, dados, ATOR)

    expect(tx.manutencao.create).toHaveBeenCalledWith({
      data: {
        veiculo: "CARRETA",
        codigo: "908",
        tipo: "CORRETIVA",
        nivel: null,
        responsavel: "RITMO",
        descricao: "troca de pneu",
        inicioPrevisto: h("2026-09-30T08:00:00"),
        fimPrevisto: null,
        filialId: FILIAL,
      },
    })
    const filtro = vi.mocked(tx.viagem.findMany).mock.calls[0][0] as { where: Record<string, unknown> }
    expect(filtro.where).toMatchObject({ filialId: FILIAL, status: { notIn: ["CANCELADA", "FINALIZADA"] }, OR: [{ carreta: { in: ["908"] } }] })
    // Uma sincronização por carreta, não por viagem.
    expect(sincronizarDisponibilidadeFrota).toHaveBeenCalledTimes(1)
    expect(sincronizarDisponibilidadeFrota).toHaveBeenCalledWith(tx, FILIAL, "76", "908")
    expect(tx.registroAuditoria.create).toHaveBeenCalled()
  })

  it("editar trocando de veículo recalcula o antigo e o novo", async () => {
    vi.mocked(prisma.manutencao.findFirst).mockResolvedValue({ id: 5, veiculo: "CAVALO", codigo: "75" } as never)
    const tx = criarTx()
    usarTx(tx)

    await editarManutencaoService(FILIAL, 5, dados, ATOR)

    const filtro = vi.mocked(tx.viagem.findMany).mock.calls[0][0] as { where: { OR: unknown[] } }
    expect(filtro.where.OR).toEqual([{ cavalo: { in: ["75"] } }, { carreta: { in: ["908"] } }])
  })

  it("concluir sem início real assume o previsto; recusa fim antes do início", async () => {
    vi.mocked(prisma.manutencao.findFirst).mockResolvedValue({
      id: 5,
      inicioPrevisto: h("2026-09-30T08:00:00"),
      inicioReal: null,
    } as never)
    const tx = criarTx()
    usarTx(tx)

    await concluirManutencaoService(FILIAL, 5, h("2026-09-30T17:30:00"), ATOR)
    expect(tx.manutencao.update).toHaveBeenCalledWith({
      where: { id: 5 },
      data: { inicioReal: h("2026-09-30T08:00:00"), fimReal: h("2026-09-30T17:30:00") },
    })

    vi.mocked(prisma.manutencao.findFirst).mockResolvedValue({ id: 5, inicioPrevisto: h("2026-09-30T08:00:00"), inicioReal: h("2026-09-30T09:00:00") } as never)
    await expect(concluirManutencaoService(FILIAL, 5, h("2026-09-30T08:30:00"), ATOR)).rejects.toThrow(/depois do início/)
  })

  it("excluir é soft delete; manutenção de outra filial não existe", async () => {
    vi.mocked(prisma.manutencao.findFirst).mockResolvedValue({ id: 5, veiculo: "CARRETA", codigo: "908" } as never)
    const tx = criarTx()
    usarTx(tx)

    await excluirManutencaoService(FILIAL, 5, ATOR)
    expect(tx.manutencao.update).toHaveBeenCalledWith({ where: { id: 5 }, data: { deletadoEm: expect.any(Date) } })
    expect(prisma.manutencao.findFirst).toHaveBeenCalledWith({ where: { id: 5, filialId: FILIAL, deletadoEm: null } })

    vi.mocked(prisma.manutencao.findFirst).mockResolvedValue(null)
    await expect(excluirManutencaoService(FILIAL, 99, ATOR)).rejects.toThrow("Manutenção não encontrada.")
  })
})
