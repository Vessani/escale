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

const FILIAL_ID = 1

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
    vi.mocked(prisma.motorista.findMany).mockResolvedValue([{ id: 42, seva: 815, diasTrabalhados: 2 }] as never)

    const resultado = await atualizarJornadaRelatorioDosMotoristas(FILIAL_ID, [criarRegistro({ diasSemFolga: 4 })])

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
    vi.mocked(prisma.motorista.findMany).mockResolvedValue([{ id: 42, seva: 815, diasTrabalhados: 6 }] as never)

    await atualizarJornadaRelatorioDosMotoristas(FILIAL_ID, [criarRegistro({ diasSemFolga: 9 })])

    const upsertArgs = vi.mocked(tx.registroJornada.upsert).mock.calls[0][0] as { create: { codigo: number } }
    expect(upsertArgs.create.codigo).toBe(6)
  })

  it("não sobrescreve o código de quem está em Férias/Exames/Interno (8-10), só o registro de horário", async () => {
    vi.mocked(prisma.motorista.findMany).mockResolvedValue([{ id: 42, seva: 815, diasTrabalhados: 8 }] as never)

    await atualizarJornadaRelatorioDosMotoristas(FILIAL_ID, [criarRegistro({ diasSemFolga: 2 })])

    expect(tx.motorista.update).toHaveBeenCalledTimes(1)
    expect(tx.registroJornada.upsert).not.toHaveBeenCalled()
  })

  it("reporta matrícula sem motorista correspondente, sem abrir transação", async () => {
    vi.mocked(prisma.motorista.findMany).mockResolvedValue([] as never)

    const resultado = await atualizarJornadaRelatorioDosMotoristas(FILIAL_ID, [criarRegistro({ matricula: 999 })])

    expect(resultado).toEqual({ atualizados: 0, naoEncontrados: [999], duplicados: [] })
    expect(prisma.$transaction).not.toHaveBeenCalled()
  })

  it("reporta matrícula duplicada (mais de um motorista ativo), sem abrir transação", async () => {
    vi.mocked(prisma.motorista.findMany).mockResolvedValue([
      { id: 1, seva: 815, diasTrabalhados: 1 },
      { id: 2, seva: 815, diasTrabalhados: 1 },
    ] as never)

    const resultado = await atualizarJornadaRelatorioDosMotoristas(FILIAL_ID, [criarRegistro({ matricula: 815 })])

    expect(resultado).toEqual({ atualizados: 0, naoEncontrados: [], duplicados: [815] })
    expect(prisma.$transaction).not.toHaveBeenCalled()
  })

  it("não consulta o banco quando a lista de registros está vazia", async () => {
    const resultado = await atualizarJornadaRelatorioDosMotoristas(FILIAL_ID, [])

    expect(resultado).toEqual({ atualizados: 0, naoEncontrados: [], duplicados: [] })
    expect(prisma.motorista.findMany).not.toHaveBeenCalled()
  })

  it("busca todos os motoristas do lote numa única query, mas grava numa transação por motorista (não uma só pro lote)", async () => {
    vi.mocked(prisma.motorista.findMany).mockResolvedValue([
      { id: 1, seva: 111, diasTrabalhados: 2 },
      { id: 2, seva: 222, diasTrabalhados: 3 },
    ] as never)

    const resultado = await atualizarJornadaRelatorioDosMotoristas(FILIAL_ID, [
      criarRegistro({ matricula: 111 }),
      criarRegistro({ matricula: 222 }),
      criarRegistro({ matricula: 999 }),
    ])

    expect(resultado).toEqual({ atualizados: 2, naoEncontrados: [999], duplicados: [] })
    expect(prisma.motorista.findMany).toHaveBeenCalledTimes(1)
    expect(prisma.$transaction).toHaveBeenCalledTimes(2)
    expect(tx.motorista.update).toHaveBeenCalledTimes(2)
  })

  it("com várias jornadas da mesma matrícula (dias diferentes), grava uma linha de calendário por dia mas só uma atualização de escalares", async () => {
    vi.mocked(prisma.motorista.findMany).mockResolvedValue([{ id: 42, seva: 815, diasTrabalhados: 2 }] as never)

    const resultado = await atualizarJornadaRelatorioDosMotoristas(FILIAL_ID, [
      criarRegistro({ dia: "2026-07-08T00:00:00.000Z", inicioJornada: "2026-07-08T08:00:00.000Z", fimJornada: "2026-07-08T18:00:00.000Z", diasSemFolga: 2 }),
      criarRegistro({ dia: "2026-07-09T00:00:00.000Z", inicioJornada: "2026-07-09T08:00:00.000Z", fimJornada: "2026-07-09T18:00:00.000Z", diasSemFolga: 3 }),
      criarRegistro({ dia: "2026-07-10T00:00:00.000Z", inicioJornada: "2026-07-10T08:00:00.000Z", fimJornada: "2026-07-10T18:00:00.000Z", diasSemFolga: 4 }),
    ])

    expect(resultado.atualizados).toBe(1)
    expect(tx.motorista.update).toHaveBeenCalledTimes(1)
    expect(tx.registroJornada.upsert).toHaveBeenCalledTimes(3)
  })

  it("usa a jornada de início mais recente do lote pros escalares jornadaRelatorio*, mesmo fora de ordem no array", async () => {
    vi.mocked(prisma.motorista.findMany).mockResolvedValue([{ id: 42, seva: 815, diasTrabalhados: 2 }] as never)

    await atualizarJornadaRelatorioDosMotoristas(FILIAL_ID, [
      criarRegistro({ dia: "2026-07-08T00:00:00.000Z", inicioJornada: "2026-07-08T08:00:00.000Z", fimJornada: "2026-07-08T18:00:00.000Z" }),
      // a mais recente vem no meio do array, não por último — prova que não é "a última iterada" que vence
      criarRegistro({ dia: "2026-07-10T00:00:00.000Z", inicioJornada: "2026-07-10T08:00:00.000Z", fimJornada: "2026-07-10T18:00:00.000Z" }),
      criarRegistro({ dia: "2026-07-09T00:00:00.000Z", inicioJornada: "2026-07-09T08:00:00.000Z", fimJornada: "2026-07-09T18:00:00.000Z" }),
    ])

    expect(tx.motorista.update).toHaveBeenCalledWith({
      where: { id: 42 },
      data: {
        jornadaRelatorioInicio: new Date("2026-07-10T08:00:00.000Z"),
        jornadaRelatorioFim: new Date("2026-07-10T18:00:00.000Z"),
        jornadaRelatorioDia: new Date("2026-07-10T00:00:00.000Z"),
      },
    })
  })

  it("reporta matrícula sem motorista/duplicada uma única vez, mesmo com várias linhas dela no lote", async () => {
    vi.mocked(prisma.motorista.findMany).mockResolvedValue([] as never)

    const resultado = await atualizarJornadaRelatorioDosMotoristas(FILIAL_ID, [
      criarRegistro({ matricula: 999, dia: "2026-07-08T00:00:00.000Z" }),
      criarRegistro({ matricula: 999, dia: "2026-07-09T00:00:00.000Z" }),
    ])

    expect(resultado).toEqual({ atualizados: 0, naoEncontrados: [999], duplicados: [] })
  })

  it("guard de status especial suprime o calendário em TODOS os dias do lote pra esse motorista, não só o primeiro", async () => {
    vi.mocked(prisma.motorista.findMany).mockResolvedValue([{ id: 42, seva: 815, diasTrabalhados: 8 }] as never)

    await atualizarJornadaRelatorioDosMotoristas(FILIAL_ID, [
      criarRegistro({ dia: "2026-07-08T00:00:00.000Z" }),
      criarRegistro({ dia: "2026-07-09T00:00:00.000Z" }),
      criarRegistro({ dia: "2026-07-10T00:00:00.000Z" }),
    ])

    expect(tx.motorista.update).toHaveBeenCalledTimes(1)
    expect(tx.registroJornada.upsert).not.toHaveBeenCalled()
  })

  it("passa o horário daquele dia específico (não o do motorista como um todo) pra registrarJornadaNoDia", async () => {
    vi.mocked(prisma.motorista.findMany).mockResolvedValue([{ id: 42, seva: 815, diasTrabalhados: 2 }] as never)

    await atualizarJornadaRelatorioDosMotoristas(FILIAL_ID, [
      criarRegistro({ dia: "2026-07-08T00:00:00.000Z", inicioJornada: "2026-07-08T06:00:00.000Z", fimJornada: "2026-07-08T14:00:00.000Z" }),
      criarRegistro({ dia: "2026-07-09T00:00:00.000Z", inicioJornada: "2026-07-09T20:00:00.000Z", fimJornada: "2026-07-10T04:00:00.000Z" }),
    ])

    const chamadas = vi.mocked(tx.registroJornada.upsert).mock.calls as Array<
      [{ create: { inicioJornada: Date; fimJornada: Date } }]
    >
    expect(chamadas[0][0].create.inicioJornada).toEqual(new Date("2026-07-08T06:00:00.000Z"))
    expect(chamadas[1][0].create.inicioJornada).toEqual(new Date("2026-07-09T20:00:00.000Z"))
  })
})
