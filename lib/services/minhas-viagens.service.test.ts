import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: vi.fn(),
    viagem: { findFirst: vi.fn(), findMany: vi.fn() },
    despesaViagem: { findFirst: vi.fn() },
  },
}))
vi.mock("@/lib/services/viagem.service", () => ({ atualizarStatusViagemService: vi.fn() }))
vi.mock("@/lib/services/auditoria.service", () => ({ registrarAuditoria: vi.fn() }))

import { prisma } from "@/lib/prisma"
import { atualizarStatusViagemService } from "@/lib/services/viagem.service"
import {
  adicionarMinhaDespesa,
  buscarMinhaViagem,
  buscarMinhasViagens,
  encerrarMinhaViagem,
  iniciarMinhaViagem,
  removerMinhaDespesa,
} from "./minhas-viagens.service"

const FILIAL = 3
const ZE = 42
const ator = { usuarioId: "m1", usuarioNome: "ZE" }
const h = (iso: string) => new Date(`${iso}-03:00`)

function criarTx() {
  return {
    viagem: { updateMany: vi.fn().mockResolvedValue({ count: 1 }), findUniqueOrThrow: vi.fn().mockResolvedValue({}) },
    despesaViagem: { create: vi.fn().mockResolvedValue({ id: 9 }), update: vi.fn().mockResolvedValue({}) },
  }
}
let tx: ReturnType<typeof criarTx>

function viagem(parcial: Record<string, unknown> = {}) {
  return { id: 1, status: "ALOCADA", inicioPrevisto: h("2026-10-02T07:00:00"), kmInicial: null, motoristaId: ZE, ...parcial }
}

beforeEach(() => {
  vi.clearAllMocks()
  tx = criarTx()
  vi.mocked(prisma.$transaction).mockImplementation(((callback: (tx: unknown) => unknown) => Promise.resolve(callback(tx))) as never)
})

describe("iniciarMinhaViagem", () => {
  it("no horário: grava km e saída real, sem motivo, e muda pra Iniciada", async () => {
    vi.mocked(prisma.viagem.findFirst).mockResolvedValue(viagem() as never)
    const agora = h("2026-10-02T07:10:00")

    await iniciarMinhaViagem(FILIAL, ZE, 1, { kmInicial: 152300, motivoAtraso: "ignorado" }, ator, agora)

    expect(prisma.viagem.findFirst).toHaveBeenCalledWith({ where: { id: 1, filialId: FILIAL, deletadoEm: null, motoristaId: ZE } })
    expect(tx.viagem.updateMany).toHaveBeenCalledWith({
      where: { id: 1, filialId: FILIAL, motoristaId: ZE, deletadoEm: null, status: { in: ["CRIADA", "ALOCADA", "POSTERGADA"] } },
      data: { kmInicial: 152300, horarioRealSaida: agora, motivoAtraso: null },
    })
    expect(atualizarStatusViagemService).toHaveBeenCalledWith(FILIAL, 1, "INICIADA", ator)
  })

  it("atrasada (passou dos 15 min) exige o motivo, e grava ele", async () => {
    vi.mocked(prisma.viagem.findFirst).mockResolvedValue(viagem() as never)
    const agora = h("2026-10-02T07:40:00")

    await expect(iniciarMinhaViagem(FILIAL, ZE, 1, { kmInicial: 10, motivoAtraso: "  " }, ator, agora)).rejects.toThrow("informe o motivo")
    expect(atualizarStatusViagemService).not.toHaveBeenCalled()

    await iniciarMinhaViagem(FILIAL, ZE, 1, { kmInicial: 10, motivoAtraso: "Troca de frota" }, ator, agora)
    expect(tx.viagem.updateMany.mock.calls[0][0].data.motivoAtraso).toBe("Troca de frota")
  })

  it("viagem de outro motorista (ou só como acompanhante) não é encontrada; já iniciada não reinicia", async () => {
    vi.mocked(prisma.viagem.findFirst).mockResolvedValue(null)
    await expect(iniciarMinhaViagem(FILIAL, ZE, 1, { kmInicial: 10, motivoAtraso: null }, ator)).rejects.toThrow("Viagem não encontrada.")

    vi.mocked(prisma.viagem.findFirst).mockResolvedValue(viagem({ status: "INICIADA" }) as never)
    await expect(iniciarMinhaViagem(FILIAL, ZE, 1, { kmInicial: 10, motivoAtraso: null }, ator)).rejects.toThrow("já foi iniciada")
  })

  it("toque duplo: se outro pedido já iniciou entre a leitura e a gravação, o segundo recebe erro e não muda o status", async () => {
    vi.mocked(prisma.viagem.findFirst).mockResolvedValue(viagem() as never)
    tx.viagem.updateMany.mockResolvedValue({ count: 0 })
    await expect(
      iniciarMinhaViagem(FILIAL, ZE, 1, { kmInicial: 10, motivoAtraso: null }, ator, h("2026-10-02T07:00:00")),
    ).rejects.toThrow("já foi iniciada")
    expect(atualizarStatusViagemService).not.toHaveBeenCalled()
  })

  it("km inválido é recusado", async () => {
    vi.mocked(prisma.viagem.findFirst).mockResolvedValue(viagem() as never)
    await expect(
      iniciarMinhaViagem(FILIAL, ZE, 1, { kmInicial: -1, motivoAtraso: null }, ator, h("2026-10-02T07:00:00")),
    ).rejects.toThrow("Km inicial")
  })
})

describe("despesas", () => {
  it("lança pedágio só com a viagem em andamento e valor válido", async () => {
    vi.mocked(prisma.viagem.findFirst).mockResolvedValue(viagem() as never)
    await expect(adicionarMinhaDespesa(FILIAL, ZE, 1, { tipo: "PEDAGIO", valorCentavos: 890 }, ator)).rejects.toThrow("Inicie a viagem")

    vi.mocked(prisma.viagem.findFirst).mockResolvedValue(viagem({ status: "INICIADA" }) as never)
    await expect(adicionarMinhaDespesa(FILIAL, ZE, 1, { tipo: "PEDAGIO", valorCentavos: 0 }, ator)).rejects.toThrow("Informe um valor")

    await adicionarMinhaDespesa(FILIAL, ZE, 1, { tipo: "PEDAGIO", valorCentavos: 890 }, ator)
    expect(tx.despesaViagem.create).toHaveBeenCalledWith({ data: { viagemId: 1, tipo: "PEDAGIO", valorCentavos: 890, usuarioId: "m1" } })
  })

  it("remove só o lançamento dele, da viagem dele, ainda em andamento", async () => {
    vi.mocked(prisma.despesaViagem.findFirst).mockResolvedValue(null)
    await expect(removerMinhaDespesa(FILIAL, ZE, 9, ator)).rejects.toThrow("Lançamento não encontrado")
    expect(prisma.despesaViagem.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 9, deletadoEm: null, usuarioId: "m1", viagem: { filialId: FILIAL, motoristaId: ZE, deletadoEm: null } } }),
    )

    vi.mocked(prisma.despesaViagem.findFirst).mockResolvedValue({ id: 9, viagem: { status: "FINALIZADA" } } as never)
    await expect(removerMinhaDespesa(FILIAL, ZE, 9, ator)).rejects.toThrow("já foi encerrada")

    vi.mocked(prisma.despesaViagem.findFirst).mockResolvedValue({ id: 9, viagem: { status: "INICIADA" } } as never)
    await removerMinhaDespesa(FILIAL, ZE, 9, ator)
    expect(tx.despesaViagem.update).toHaveBeenCalledWith({ where: { id: 9 }, data: { deletadoEm: expect.any(Date) } })
  })
})

describe("encerrarMinhaViagem", () => {
  it("km final não pode ser menor que o inicial nem absurdo; certo → Finalizada", async () => {
    vi.mocked(prisma.viagem.findFirst).mockResolvedValue(viagem({ status: "INICIADA", kmInicial: 1000 }) as never)

    await expect(encerrarMinhaViagem(FILIAL, ZE, 1, { kmFinal: 900 }, ator)).rejects.toThrow("não pode ser menor")
    await expect(encerrarMinhaViagem(FILIAL, ZE, 1, { kmFinal: 20000 }, ator)).rejects.toThrow("confira o km final")

    await encerrarMinhaViagem(FILIAL, ZE, 1, { kmFinal: 1350 }, ator)
    expect(tx.viagem.updateMany).toHaveBeenCalledWith({
      where: { id: 1, filialId: FILIAL, motoristaId: ZE, deletadoEm: null, status: { in: ["INICIADA", "RETORNANDO"] } },
      data: { kmFinal: 1350 },
    })
    expect(atualizarStatusViagemService).toHaveBeenCalledWith(FILIAL, 1, "FINALIZADA", ator)
  })

  it("toque duplo no encerrar: o segundo recebe erro", async () => {
    vi.mocked(prisma.viagem.findFirst).mockResolvedValue(viagem({ status: "INICIADA", kmInicial: 1000 }) as never)
    tx.viagem.updateMany.mockResolvedValue({ count: 0 })
    await expect(encerrarMinhaViagem(FILIAL, ZE, 1, { kmFinal: 1350 }, ator)).rejects.toThrow("em andamento")
    expect(atualizarStatusViagemService).not.toHaveBeenCalled()
  })

  it("não encerra viagem que nem começou", async () => {
    vi.mocked(prisma.viagem.findFirst).mockResolvedValue(viagem() as never)
    await expect(encerrarMinhaViagem(FILIAL, ZE, 1, { kmFinal: 10 }, ator)).rejects.toThrow("em andamento")
  })
})

describe("consulta", () => {
  it("só acha viagem da filial em que ele é principal ou acompanhante", async () => {
    vi.mocked(prisma.viagem.findFirst).mockResolvedValue(null)
    await buscarMinhaViagem(FILIAL, ZE, 7)
    expect(vi.mocked(prisma.viagem.findFirst).mock.calls[0][0]?.where).toEqual({
      id: 7,
      filialId: FILIAL,
      deletadoEm: null,
      OR: [{ motoristaId: ZE }, { motoristaAcompanhanteId: ZE }],
    })
  })

  it("a lista filtra pelo motorista E pela situação (um filtro não pode apagar o outro)", async () => {
    vi.mocked(prisma.viagem.findMany).mockResolvedValue([])
    await buscarMinhasViagens(FILIAL, ZE, h("2026-10-02T10:00:00"))

    const where = vi.mocked(prisma.viagem.findMany).mock.calls[0][0]?.where as Record<string, unknown>
    expect(where.filialId).toBe(FILIAL)
    expect(where.OR).toBeUndefined()
    expect(where.AND).toEqual([
      { OR: [{ motoristaId: ZE }, { motoristaAcompanhanteId: ZE }] },
      { OR: expect.arrayContaining([{ status: { in: ["INICIADA", "RETORNANDO"] } }]) },
    ])
  })
})

