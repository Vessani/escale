import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/prisma", () => ({
  prisma: { $transaction: vi.fn(), viagem: { findFirst: vi.fn() }, motorista: { findFirst: vi.fn() } },
}))
vi.mock("@/lib/services/auditoria.service", () => ({ registrarAuditoria: vi.fn() }))
vi.mock("@/lib/services/folga.service", () => ({ reconciliarFolgaMotoristasNoDiaAtual: vi.fn() }))
vi.mock("@/lib/services/interjornada.service", () => ({ recalcularAvisosInterjornada: vi.fn() }))

import { prisma } from "@/lib/prisma"
import { recalcularAvisosInterjornada } from "@/lib/services/interjornada.service"
import { trocarMotoristaDaViagem } from "./troca-motorista.service"

const FILIAL = 3
const ator = { usuarioId: "u1", usuarioNome: "Alan" }
const h = (iso: string) => new Date(`${iso}-03:00`)
const agora = h("2026-10-02T15:00:00")

const tx = {
  viagem: { updateMany: vi.fn(), findUniqueOrThrow: vi.fn().mockResolvedValue({ id: 1 }) },
  trocaMotorista: { create: vi.fn().mockResolvedValue({ id: 9 }) },
}

function viagem(parcial: Record<string, unknown> = {}) {
  return {
    id: 1, status: "INICIADA", motoristaId: 7, motoristaAcompanhanteId: null, kmInicial: 152300,
    horarioRealSaida: h("2026-10-02T07:00:00"), inicioPrevisto: h("2026-10-02T07:00:00"), fimPrevisto: h("2026-10-02T20:00:00"),
    ...parcial,
  }
}
const dados = (parcial: Record<string, unknown> = {}) => ({
  motoristaNovoId: 4, km: 152600, trocadoEm: h("2026-10-02T12:00:00"), local: " Posto Graal, Curitiba ", motivo: " Estouro de jornada ", ...parcial,
})

beforeEach(() => {
  vi.clearAllMocks()
  tx.viagem.updateMany.mockResolvedValue({ count: 1 })
  vi.mocked(prisma.$transaction).mockImplementation(((cb: (t: unknown) => unknown) => Promise.resolve(cb(tx))) as never)
  vi.mocked(prisma.viagem.findFirst).mockResolvedValue(viagem() as never)
  vi.mocked(prisma.motorista.findFirst).mockResolvedValue({ id: 4, nome: "HUGO SUSIN" } as never)
})

describe("trocarMotoristaDaViagem", () => {
  it("passa a viagem pro substituto só se ainda estiver com o anterior e em andamento, grava a troca e recalcula descanso dos dois", async () => {
    await expect(trocarMotoristaDaViagem(FILIAL, 1, dados(), ator, {}, agora)).resolves.toEqual({ motoristaNovo: "HUGO SUSIN" })

    expect(tx.viagem.updateMany).toHaveBeenCalledWith({
      where: { id: 1, filialId: FILIAL, deletadoEm: null, motoristaId: 7, status: { in: ["INICIADA", "RETORNANDO"] } },
      data: { motoristaId: 4 },
    })
    expect(tx.trocaMotorista.create).toHaveBeenCalledWith({
      data: { viagemId: 1, motoristaAnteriorId: 7, motoristaNovoId: 4, km: 152600, trocadoEm: h("2026-10-02T12:00:00"), local: "Posto Graal, Curitiba", motivo: "Estouro de jornada", usuarioId: "u1" },
    })
    expect(recalcularAvisosInterjornada).toHaveBeenCalledWith(tx, FILIAL, [7, 4])
  })

  it("pelo motorista: só quem está com a viagem pode passar", async () => {
    await trocarMotoristaDaViagem(FILIAL, 1, dados(), ator, { exigirMotoristaAtual: 7 }, agora)
    expect(prisma.viagem.findFirst).toHaveBeenCalledWith({ where: { id: 1, filialId: FILIAL, deletadoEm: null, motoristaId: 7 } })

    vi.mocked(prisma.viagem.findFirst).mockResolvedValue(null)
    await expect(trocarMotoristaDaViagem(FILIAL, 1, dados(), ator, { exigirMotoristaAtual: 99 }, agora)).rejects.toThrow("Viagem não encontrada")
  })

  it("substituto que era o acompanhante vira principal e libera o lugar de acompanhante", async () => {
    vi.mocked(prisma.viagem.findFirst).mockResolvedValue(viagem({ motoristaAcompanhanteId: 4 }) as never)
    await trocarMotoristaDaViagem(FILIAL, 1, dados(), ator, {}, agora)
    expect(tx.viagem.updateMany.mock.calls[0][0].data).toEqual({ motoristaId: 4, motoristaAcompanhanteId: null })
  })

  it("recusa: viagem não iniciada, mesmo motorista, substituto fora do cadastro, km fora, hora errada, sem local/motivo, viagem mudou", async () => {
    const tentar = (d = dados()) => trocarMotoristaDaViagem(FILIAL, 1, d, ator, {}, agora)

    vi.mocked(prisma.viagem.findFirst).mockResolvedValueOnce(viagem({ status: "ALOCADA" }) as never)
    await expect(tentar()).rejects.toThrow("realocar na Gestão de Viagens")
    await expect(tentar(dados({ motoristaNovoId: 7 }))).rejects.toThrow("diferente do atual")
    vi.mocked(prisma.motorista.findFirst).mockResolvedValueOnce(null)
    await expect(tentar()).rejects.toThrow("não encontrado no cadastro")
    await expect(tentar(dados({ km: 152000 }))).rejects.toThrow("entre o km inicial")
    await expect(tentar(dados({ trocadoEm: h("2026-10-02T16:00:00") }))).rejects.toThrow("no futuro")
    await expect(tentar(dados({ trocadoEm: h("2026-10-02T06:00:00") }))).rejects.toThrow("antes da saída")
    await expect(tentar(dados({ local: "  " }))).rejects.toThrow("local")
    await expect(tentar(dados({ motivo: "" }))).rejects.toThrow("motivo")
    expect(tx.trocaMotorista.create).not.toHaveBeenCalled()

    tx.viagem.updateMany.mockResolvedValue({ count: 0 })
    await expect(tentar()).rejects.toThrow("alterada nesse meio-tempo")
    expect(tx.trocaMotorista.create).not.toHaveBeenCalled()
  })
})
