import { describe, expect, it, vi, beforeEach } from "vitest"
import type { RegistroJornadaRelatorio } from "@/lib/parsers/jornada-relatorio-parser"

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: vi.fn(),
    motorista: { findMany: vi.fn() },
    filial: { updateMany: vi.fn() },
  },
}))

vi.mock("@/lib/services/interjornada.service", () => ({
  recalcularAvisosInterjornada: vi.fn(),
}))

import { prisma } from "@/lib/prisma"
import { atualizarJornadaRelatorioDosMotoristas, registrarAjustesJornada } from "@/lib/services/jornada-relatorio.service"

const FILIAL_ID = 1

function criarRegistro(parcial: Partial<RegistroJornadaRelatorio> = {}): RegistroJornadaRelatorio {
  return {
    matricula: 815,
    nome: "Motorista Teste",
    inicioJornada: "2026-07-10T04:10:08.000Z",
    fimJornada: "2026-07-10T08:52:45.000Z",
    dia: "2026-07-10T00:00:00.000Z",
    diasSemFolga: 3,
    diasSemFolgaRelatorio: 3,
    correcao: null,
    ...parcial,
  }
}

function criarTx() {
  return {
    motorista: { update: vi.fn() },
    registroJornada: { upsert: vi.fn(), findMany: vi.fn().mockResolvedValue([]), deleteMany: vi.fn() },
  }
}

/** Faz `prisma.$transaction(callback)` invocar `callback(tx)` toda vez que for chamado — um registro por transação. */
function usarTransacaoCom(tx: ReturnType<typeof criarTx>) {
  vi.mocked(prisma.$transaction).mockImplementation(((callback: (tx: unknown) => unknown) => Promise.resolve(callback(tx))) as never)
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

    expect(resultado).toEqual({ atualizados: 1, naoEncontrados: [], duplicados: [], diasRemovidos: 0 })
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

  it("avança a cobertura do relatório da filial pro dia mais recente do lote (nunca pra trás)", async () => {
    vi.mocked(prisma.motorista.findMany).mockResolvedValue([{ id: 42, seva: 815, diasTrabalhados: 2 }] as never)

    await atualizarJornadaRelatorioDosMotoristas(FILIAL_ID, [
      criarRegistro({ dia: "2026-07-10T03:00:00.000Z" }),
      criarRegistro({ dia: "2026-07-12T03:00:00.000Z", inicioJornada: "2026-07-12T10:00:00.000Z", fimJornada: "2026-07-12T18:00:00.000Z" }),
    ])

    const cobertura = new Date("2026-07-12T00:00:00.000Z")
    expect(prisma.filial.updateMany).toHaveBeenCalledWith({
      where: { id: FILIAL_ID, OR: [{ relatorioJornadaAte: null }, { relatorioJornadaAte: { lt: cobertura } }] },
      data: { relatorioJornadaAte: cobertura },
    })
  })

  it("capa em 6 quando Dias Sem Folga vem maior (7+) — evita colidir com o código 7 (Folga)", async () => {
    vi.mocked(prisma.motorista.findMany).mockResolvedValue([{ id: 42, seva: 815, diasTrabalhados: 6 }] as never)

    await atualizarJornadaRelatorioDosMotoristas(FILIAL_ID, [criarRegistro({ diasSemFolga: 9 })])

    const upsertArgs = vi.mocked(tx.registroJornada.upsert).mock.calls[0][0] as {
      create: { codigo: number; diasSemFolga: number }
      update: { diasSemFolga: number }
    }
    expect(upsertArgs.create.codigo).toBe(6)
    // ...mas o número real fica guardado pro relatório de dias sem folga.
    expect(upsertArgs.create.diasSemFolga).toBe(9)
    expect(upsertArgs.update.diasSemFolga).toBe(9)
  })

  it("não sobrescreve o dia marcado à mão como Férias/Exames/Interno (8-10) — só aquele dia", async () => {
    vi.mocked(prisma.motorista.findMany).mockResolvedValue([{ id: 42, seva: 815, diasTrabalhados: 2 }] as never)
    vi.mocked(tx.registroJornada.findMany).mockResolvedValue([
      { id: 7, data: new Date("2026-07-09T00:00:00.000Z"), codigo: 8, inicioJornada: null },
    ] as never)

    await atualizarJornadaRelatorioDosMotoristas(FILIAL_ID, [
      criarRegistro({ dia: "2026-07-08T03:00:00.000Z" }),
      criarRegistro({ dia: "2026-07-09T03:00:00.000Z" }),
    ])

    expect(tx.motorista.update).toHaveBeenCalledTimes(1)
    expect(tx.registroJornada.upsert).toHaveBeenCalledTimes(1)
    expect(tx.registroJornada.deleteMany).not.toHaveBeenCalled()
  })

  it("reporta matrícula sem motorista correspondente, sem abrir transação", async () => {
    vi.mocked(prisma.motorista.findMany).mockResolvedValue([] as never)

    const resultado = await atualizarJornadaRelatorioDosMotoristas(FILIAL_ID, [criarRegistro({ matricula: 999 })])

    expect(resultado).toEqual({ atualizados: 0, naoEncontrados: [999], duplicados: [], diasRemovidos: 0 })
    expect(prisma.$transaction).not.toHaveBeenCalled()
  })

  it("reporta matrícula duplicada (mais de um motorista ativo), sem abrir transação", async () => {
    vi.mocked(prisma.motorista.findMany).mockResolvedValue([
      { id: 1, seva: 815, diasTrabalhados: 1 },
      { id: 2, seva: 815, diasTrabalhados: 1 },
    ] as never)

    const resultado = await atualizarJornadaRelatorioDosMotoristas(FILIAL_ID, [criarRegistro({ matricula: 815 })])

    expect(resultado).toEqual({ atualizados: 0, naoEncontrados: [], duplicados: [815], diasRemovidos: 0 })
    expect(prisma.$transaction).not.toHaveBeenCalled()
  })

  it("não consulta o banco quando a lista de registros está vazia", async () => {
    const resultado = await atualizarJornadaRelatorioDosMotoristas(FILIAL_ID, [])

    expect(resultado).toEqual({ atualizados: 0, naoEncontrados: [], duplicados: [], diasRemovidos: 0 })
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

    expect(resultado).toEqual({ atualizados: 2, naoEncontrados: [999], duplicados: [], diasRemovidos: 0 })
    expect(prisma.motorista.findMany).toHaveBeenCalledTimes(1)
    expect(prisma.$transaction).toHaveBeenCalledTimes(2)
    expect(tx.motorista.update).toHaveBeenCalledTimes(2)
  })

  it("com várias jornadas da mesma matrícula (dias diferentes), grava uma linha de calendário por dia mas só uma atualização de escalares", async () => {
    vi.mocked(prisma.motorista.findMany).mockResolvedValue([{ id: 42, seva: 815, diasTrabalhados: 2 }] as never)

    const resultado = await atualizarJornadaRelatorioDosMotoristas(FILIAL_ID, [
      criarRegistro({
        dia: "2026-07-08T00:00:00.000Z",
        inicioJornada: "2026-07-08T08:00:00.000Z",
        fimJornada: "2026-07-08T18:00:00.000Z",
        diasSemFolga: 2,
      }),
      criarRegistro({
        dia: "2026-07-09T00:00:00.000Z",
        inicioJornada: "2026-07-09T08:00:00.000Z",
        fimJornada: "2026-07-09T18:00:00.000Z",
        diasSemFolga: 3,
      }),
      criarRegistro({
        dia: "2026-07-10T00:00:00.000Z",
        inicioJornada: "2026-07-10T08:00:00.000Z",
        fimJornada: "2026-07-10T18:00:00.000Z",
        diasSemFolga: 4,
      }),
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

    expect(resultado).toEqual({ atualizados: 0, naoEncontrados: [999], duplicados: [], diasRemovidos: 0 })
  })

  it("motorista em Férias/Exames/Interno hoje ainda tem os dias passados do relatório atualizados (antes o mês todo dele era pulado)", async () => {
    vi.mocked(prisma.motorista.findMany).mockResolvedValue([{ id: 42, seva: 815, diasTrabalhados: 8 }] as never)

    await atualizarJornadaRelatorioDosMotoristas(FILIAL_ID, [
      criarRegistro({ dia: "2026-07-08T03:00:00.000Z" }),
      criarRegistro({ dia: "2026-07-09T03:00:00.000Z" }),
      criarRegistro({ dia: "2026-07-10T03:00:00.000Z" }),
    ])

    expect(tx.registroJornada.upsert).toHaveBeenCalledTimes(3)
  })

  it("re-importar apaga, no período do arquivo, o dia de importação anterior que saiu do lote — e mantém lançamento manual e status especial", async () => {
    vi.mocked(prisma.motorista.findMany).mockResolvedValue([{ id: 42, seva: 815, diasTrabalhados: 2 }] as never)
    vi.mocked(tx.registroJornada.findMany).mockResolvedValue([
      { id: 1, data: new Date("2026-07-08T00:00:00.000Z"), codigo: 3, inicioJornada: new Date() }, // no lote: regravado
      { id: 2, data: new Date("2026-07-09T00:00:00.000Z"), codigo: 4, inicioJornada: new Date() }, // saiu do lote: apaga
      { id: 3, data: new Date("2026-07-10T00:00:00.000Z"), codigo: 7, inicioJornada: null }, // folga lançada à mão: fica
      { id: 4, data: new Date("2026-07-11T00:00:00.000Z"), codigo: 9, inicioJornada: new Date() }, // exames: fica
    ] as never)

    const resultado = await atualizarJornadaRelatorioDosMotoristas(FILIAL_ID, [criarRegistro({ dia: "2026-07-08T03:00:00.000Z" })], {
      de: "2026-07-01T10:00:00.000Z",
      ate: "2026-07-31T10:00:00.000Z",
      matriculas: [815],
    })

    expect(tx.registroJornada.findMany).toHaveBeenCalledWith({
      where: { motoristaId: 42, data: { gte: new Date("2026-07-01T00:00:00.000Z"), lte: new Date("2026-07-31T00:00:00.000Z") } },
      select: { id: true, data: true, codigo: true, inicioJornada: true },
    })
    expect(tx.registroJornada.deleteMany).toHaveBeenCalledWith({ where: { id: { in: [2] } } })
    expect(resultado.diasRemovidos).toBe(1)
  })

  it("motorista do arquivo com todas as linhas excluídas na conferência também tem os dias antigos apagados", async () => {
    vi.mocked(prisma.motorista.findMany).mockResolvedValue([{ id: 42, seva: 815, diasTrabalhados: 2 }] as never)
    vi.mocked(tx.registroJornada.findMany).mockResolvedValue([
      { id: 9, data: new Date("2026-07-09T00:00:00.000Z"), codigo: 4, inicioJornada: new Date() },
    ] as never)

    const resultado = await atualizarJornadaRelatorioDosMotoristas(FILIAL_ID, [], {
      de: "2026-07-01T10:00:00.000Z",
      ate: "2026-07-31T10:00:00.000Z",
      matriculas: [815],
    })

    expect(tx.motorista.update).not.toHaveBeenCalled()
    expect(tx.registroJornada.deleteMany).toHaveBeenCalledWith({ where: { id: { in: [9] } } })
    expect(resultado).toMatchObject({ atualizados: 1, diasRemovidos: 1 })
  })

  it("passa o horário daquele dia específico (não o do motorista como um todo) pra registrarJornadaNoDia", async () => {
    vi.mocked(prisma.motorista.findMany).mockResolvedValue([{ id: 42, seva: 815, diasTrabalhados: 2 }] as never)

    await atualizarJornadaRelatorioDosMotoristas(FILIAL_ID, [
      criarRegistro({ dia: "2026-07-08T00:00:00.000Z", inicioJornada: "2026-07-08T06:00:00.000Z", fimJornada: "2026-07-08T14:00:00.000Z" }),
      criarRegistro({ dia: "2026-07-09T00:00:00.000Z", inicioJornada: "2026-07-09T20:00:00.000Z", fimJornada: "2026-07-10T04:00:00.000Z" }),
    ])

    const chamadas = vi.mocked(tx.registroJornada.upsert).mock.calls as Array<[{ create: { inicioJornada: Date; fimJornada: Date } }]>
    expect(chamadas[0][0].create.inicioJornada).toEqual(new Date("2026-07-08T06:00:00.000Z"))
    expect(chamadas[1][0].create.inicioJornada).toEqual(new Date("2026-07-09T20:00:00.000Z"))
  })
})

describe("registrarAjustesJornada", () => {
  beforeEach(() => vi.clearAllMocks())

  it("grava um registro 'Jornada' no histórico por linha ajustada, com antes → depois", async () => {
    const tx = { registroAuditoria: { create: vi.fn() } }
    vi.mocked(prisma.$transaction).mockImplementation(((callback: (tx: unknown) => unknown) => Promise.resolve(callback(tx))) as never)

    await registrarAjustesJornada(
      FILIAL_ID,
      [
        {
          matricula: 101,
          dia: "2026-09-17T03:00:00.000Z",
          contexto: "Importação do relatório · MOTORISTA (101)",
          antes: { "Dias sem folga": 5 },
          depois: { "Dias sem folga": 4 },
        },
      ],
      { usuarioId: "u1", usuarioNome: "Alan" },
    )

    expect(tx.registroAuditoria.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        entidade: "RegistroJornada",
        entidadeId: "101-2026-09-17",
        acao: "ATUALIZACAO",
        antes: { "Dias sem folga": 5 },
        depois: { "Dias sem folga": 4, _contexto: "Importação do relatório · MOTORISTA (101)" },
        usuarioNome: "Alan",
        filialId: FILIAL_ID,
      }),
    })
  })

  it("sem ajustes não abre transação", async () => {
    await registrarAjustesJornada(FILIAL_ID, [], null)
    expect(prisma.$transaction).not.toHaveBeenCalled()
  })
})
