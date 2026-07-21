import { describe, expect, it, vi, beforeEach } from "vitest"
import type { RegistroJornadaRelatorio } from "@/lib/parsers/jornada-relatorio-parser"

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: vi.fn(),
    motorista: { findMany: vi.fn() },
  },
}))

import { prisma } from "@/lib/prisma"
import { atualizarJornadaRelatorioDosMotoristas } from "@/lib/services/jornada-relatorio.service"

function criarRegistro(parcial: Partial<RegistroJornadaRelatorio> = {}): RegistroJornadaRelatorio {
  return {
    matricula: 815,
    nome: "Motorista Teste",
    inicioJornada: "2026-07-10T04:10:08.000Z",
    fimJornada: "2026-07-10T08:52:45.000Z",
    dia: "2026-07-10T00:00:00.000Z",
    diasSemFolga: 3,
    ...parcial,
  }
}

function criarTx() {
  return {
    motorista: { update: vi.fn() },
    registroJornada: { upsert: vi.fn() },
  }
}

/** Faz `prisma.$transaction(callback)` invocar `callback(tx)` toda vez que for chamado — um registro por transação. */
function usarTransacaoCom(tx: ReturnType<typeof criarTx>) {
  vi.mocked(prisma.$transaction).mockImplementation(((callback: (tx: unknown) => unknown) =>
    Promise.resolve(callback(tx))) as never)
}

describe("atualizarJornadaRelatorioDosMotoristas", () => {
  let tx: ReturnType<typeof criarTx>

  beforeEach(() => {
    vi.clearAllMocks()
    tx = criarTx()
    vi.mocked(tx.registroJornada.upsert).mockResolvedValue({})
    usarTransacaoCom(tx)
  })

  it("atualiza jornadaRelatorio* e grava o código do dia (Dias Sem Folga) quando a matrícula bate com um motorista em ciclo normal", async () => {
    vi.mocked(prisma.motorista.findMany).mockResolvedValue([{ id: 42, diasTrabalhados: 2 }] as never)

    const resultado = await atualizarJornadaRelatorioDosMotoristas([criarRegistro({ diasSemFolga: 4 })])

    expect(resultado).toEqual({ atualizados: 1, naoEncontrados: [], duplicados: [] })
    expect(tx.motorista.update).toHaveBeenCalledWith({
      where: { id: 42 },
      data: {
        jornadaRelatorioInicio: new Date("2026-07-10T04:10:08.000Z"),
        jornadaRelatorioFim: new Date("2026-07-10T08:52:45.000Z"),
        jornadaRelatorioDia: new Date("2026-07-10T00:00:00.000Z"),
      },
    })
    const upsertArgs = vi.mocked(tx.registroJornada.upsert).mock.calls[0][0] as {
      where: { motoristaId_data: { motoristaId: number } }
      create: { codigo: number }
    }
    expect(upsertArgs.where.motoristaId_data.motoristaId).toBe(42)
    expect(upsertArgs.create.codigo).toBe(4)
  })

  it("capa em 6 quando Dias Sem Folga vem maior (7+) — evita colidir com o código 7 (Folga)", async () => {
    vi.mocked(prisma.motorista.findMany).mockResolvedValue([{ id: 42, diasTrabalhados: 6 }] as never)

    await atualizarJornadaRelatorioDosMotoristas([criarRegistro({ diasSemFolga: 9 })])

    const upsertArgs = vi.mocked(tx.registroJornada.upsert).mock.calls[0][0] as { create: { codigo: number } }
    expect(upsertArgs.create.codigo).toBe(6)
  })

  it("não sobrescreve o código de quem está em Férias/Exames/Interno (8-10), só o registro de horário", async () => {
    vi.mocked(prisma.motorista.findMany).mockResolvedValue([{ id: 42, diasTrabalhados: 8 }] as never)

    await atualizarJornadaRelatorioDosMotoristas([criarRegistro({ diasSemFolga: 2 })])

    expect(tx.motorista.update).toHaveBeenCalledTimes(1)
    expect(tx.registroJornada.upsert).not.toHaveBeenCalled()
  })

  it("reporta matrícula sem motorista correspondente, sem abrir transação", async () => {
    vi.mocked(prisma.motorista.findMany).mockResolvedValue([] as never)

    const resultado = await atualizarJornadaRelatorioDosMotoristas([criarRegistro({ matricula: 999 })])

    expect(resultado).toEqual({ atualizados: 0, naoEncontrados: [999], duplicados: [] })
    expect(prisma.$transaction).not.toHaveBeenCalled()
  })

  it("reporta matrícula duplicada (mais de um motorista ativo), sem abrir transação", async () => {
    vi.mocked(prisma.motorista.findMany).mockResolvedValue([
      { id: 1, diasTrabalhados: 1 },
      { id: 2, diasTrabalhados: 1 },
    ] as never)

    const resultado = await atualizarJornadaRelatorioDosMotoristas([criarRegistro({ matricula: 815 })])

    expect(resultado).toEqual({ atualizados: 0, naoEncontrados: [], duplicados: [815] })
    expect(prisma.$transaction).not.toHaveBeenCalled()
  })

  it("não consulta o banco quando a lista de registros está vazia", async () => {
    const resultado = await atualizarJornadaRelatorioDosMotoristas([])

    expect(resultado).toEqual({ atualizados: 0, naoEncontrados: [], duplicados: [] })
    expect(prisma.motorista.findMany).not.toHaveBeenCalled()
  })
})
