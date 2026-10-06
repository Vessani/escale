import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: vi.fn(),
    viagem: { findFirst: vi.fn(), findMany: vi.fn() },
    despesaViagem: { findFirst: vi.fn() },
    entrega: { findFirst: vi.fn() },
  },
}))
vi.mock("@/lib/services/viagem-andamento.service", () => ({ atualizarStatusViagemService: vi.fn(), CODIGO_VIAGEM_MUDOU: "VIAGEM_MUDOU" }))
vi.mock("@/lib/services/auditoria.service", () => ({ registrarAuditoria: vi.fn() }))

import { prisma } from "@/lib/prisma"
import { ErroDeDominio } from "@/lib/errors"
import { atualizarStatusViagemService } from "@/lib/services/viagem-andamento.service"
import {
  adicionarMinhaDespesa,
  buscarMinhaViagem,
  buscarMinhasViagens,
  encerrarMinhaViagem,
  informarProblemaMecanico,
  iniciarMinhaViagem,
  registrarChegadaCliente,
  removerMinhaDespesa,
} from "./minhas-viagens.service"

const FILIAL = 3
const ZE = 42
const ator = { usuarioId: "m1", usuarioNome: "ZE" }
const h = (iso: string) => new Date(`${iso}-03:00`)

function criarTx() {
  return {
    despesaViagem: { create: vi.fn().mockResolvedValue({ id: 9 }), update: vi.fn().mockResolvedValue({}) },
    chegadaEntrega: { upsert: vi.fn().mockResolvedValue({ id: 3 }), findUnique: vi.fn().mockResolvedValue(null) },
    viagem: { updateMany: vi.fn().mockResolvedValue({ count: 1 }), findUniqueOrThrow: vi.fn().mockResolvedValue({}) },
    // SELECT … FOR UPDATE: a viagem ainda é dele e está no status esperado.
    $queryRaw: vi.fn().mockResolvedValue([{ id: 1 }]),
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

const A_INICIAR = ["CRIADA", "ALOCADA", "POSTERGADA"]
const EM_ANDAMENTO = ["INICIADA", "RETORNANDO"]
const despachoMudouAViagem = () => vi.mocked(atualizarStatusViagemService).mockRejectedValueOnce(new ErroDeDominio("VIAGEM_MUDOU", "x"))

describe("iniciarMinhaViagem", () => {
  it("no horário: km, saída real e Iniciada numa escrita só, condicionada a ainda ser dele e não ter saído", async () => {
    vi.mocked(prisma.viagem.findFirst).mockResolvedValue(viagem() as never)
    const agora = h("2026-10-02T07:10:00")

    await iniciarMinhaViagem(FILIAL, ZE, 1, { kmInicial: 152300, motivoAtraso: "ignorado" }, ator, agora)

    expect(prisma.viagem.findFirst).toHaveBeenCalledWith({ where: { id: 1, filialId: FILIAL, deletadoEm: null, motoristaId: ZE } })
    expect(atualizarStatusViagemService).toHaveBeenCalledWith(FILIAL, 1, "INICIADA", ator, undefined, {
      motoristaId: ZE,
      statusEsperados: A_INICIAR,
      dados: { kmInicial: 152300, horarioRealSaida: agora, motivoAtraso: null },
    })
  })

  it("atrasada (passou dos 15 min) exige o motivo, e grava ele", async () => {
    vi.mocked(prisma.viagem.findFirst).mockResolvedValue(viagem() as never)
    const agora = h("2026-10-02T07:40:00")

    await expect(iniciarMinhaViagem(FILIAL, ZE, 1, { kmInicial: 10, motivoAtraso: "  " }, ator, agora)).rejects.toThrow("informe o motivo")
    expect(atualizarStatusViagemService).not.toHaveBeenCalled()

    await iniciarMinhaViagem(FILIAL, ZE, 1, { kmInicial: 10, motivoAtraso: "Troca de frota" }, ator, agora)
    expect(vi.mocked(atualizarStatusViagemService).mock.calls[0][5]?.dados.motivoAtraso).toBe("Troca de frota")
  })

  it("postergada ainda pode ser iniciada (só mudou a data)", async () => {
    vi.mocked(prisma.viagem.findFirst).mockResolvedValue(viagem({ status: "POSTERGADA" }) as never)
    await iniciarMinhaViagem(FILIAL, ZE, 1, { kmInicial: 10, motivoAtraso: null }, ator, h("2026-10-02T07:00:00"))
    expect(atualizarStatusViagemService).toHaveBeenCalled()
  })

  it("tela desatualizada: diz o motivo certo — cancelada, trocou de motorista/excluída, já iniciada", async () => {
    // cancelada
    vi.mocked(prisma.viagem.findFirst).mockResolvedValue(viagem({ status: "CANCELADA" }) as never)
    await expect(iniciarMinhaViagem(FILIAL, ZE, 1, { kmInicial: 10, motivoAtraso: null }, ator)).rejects.toThrow("cancelada pelo escalador")
    // passada pra outro motorista (a busca do principal não acha; a explicação vê outro dono)
    vi.mocked(prisma.viagem.findFirst).mockResolvedValueOnce(null).mockResolvedValueOnce(viagem({ motoristaId: 99 }) as never)
    await expect(iniciarMinhaViagem(FILIAL, ZE, 1, { kmInicial: 10, motivoAtraso: null }, ator)).rejects.toThrow("não está mais com você")
    // excluída / inexistente
    vi.mocked(prisma.viagem.findFirst).mockResolvedValue(null)
    await expect(iniciarMinhaViagem(FILIAL, ZE, 1, { kmInicial: 10, motivoAtraso: null }, ator)).rejects.toThrow("não está mais com você")
    // já iniciada
    vi.mocked(prisma.viagem.findFirst).mockResolvedValue(viagem({ status: "INICIADA" }) as never)
    await expect(iniciarMinhaViagem(FILIAL, ZE, 1, { kmInicial: 10, motivoAtraso: null }, ator)).rejects.toThrow("já foi iniciada")
    expect(atualizarStatusViagemService).not.toHaveBeenCalled()
  })

  it("despacho cancela no mesmo segundo em que ele toca em Iniciar: nada gravado, e ele vê que foi cancelada", async () => {
    vi.mocked(prisma.viagem.findFirst)
      .mockResolvedValueOnce(viagem() as never) // leitura: ainda Alocada
      .mockResolvedValueOnce(viagem({ status: "CANCELADA" }) as never) // depois da escrita recusada
    despachoMudouAViagem()
    await expect(
      iniciarMinhaViagem(FILIAL, ZE, 1, { kmInicial: 10, motivoAtraso: null }, ator, h("2026-10-02T07:00:00")),
    ).rejects.toThrow("cancelada pelo escalador")
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

    vi.mocked(prisma.despesaViagem.findFirst).mockResolvedValue({ id: 9, viagemId: 1, viagem: { status: "FINALIZADA" } } as never)
    await expect(removerMinhaDespesa(FILIAL, ZE, 9, ator)).rejects.toThrow("já foi encerrada")

    vi.mocked(prisma.despesaViagem.findFirst).mockResolvedValue({ id: 9, viagemId: 1, viagem: { status: "INICIADA" } } as never)
    await removerMinhaDespesa(FILIAL, ZE, 9, ator)
    expect(tx.despesaViagem.update).toHaveBeenCalledWith({ where: { id: 9 }, data: { deletadoEm: expect.any(Date) } })
  })
})

describe("encerrarMinhaViagem", () => {
  it("km final não pode ser menor que o inicial nem absurdo; certo → Finalizada, condicionada a estar em andamento", async () => {
    vi.mocked(prisma.viagem.findFirst).mockResolvedValue(viagem({ status: "INICIADA", kmInicial: 1000 }) as never)

    await expect(encerrarMinhaViagem(FILIAL, ZE, 1, { kmFinal: 900 }, ator)).rejects.toThrow("não pode ser menor")
    await expect(encerrarMinhaViagem(FILIAL, ZE, 1, { kmFinal: 20000 }, ator)).rejects.toThrow("confira o km final")

    await encerrarMinhaViagem(FILIAL, ZE, 1, { kmFinal: 1350 }, ator)
    expect(atualizarStatusViagemService).toHaveBeenCalledWith(FILIAL, 1, "FINALIZADA", ator, undefined, {
      motoristaId: ZE,
      statusEsperados: EM_ANDAMENTO,
      dados: { kmFinal: 1350 },
    })
  })

  it("toque duplo: o segundo encerrar vê que já foi encerrada", async () => {
    vi.mocked(prisma.viagem.findFirst)
      .mockResolvedValueOnce(viagem({ status: "INICIADA", kmInicial: 1000 }) as never)
      .mockResolvedValueOnce(viagem({ status: "FINALIZADA" }) as never)
    despachoMudouAViagem()
    await expect(encerrarMinhaViagem(FILIAL, ZE, 1, { kmFinal: 1350 }, ator)).rejects.toThrow("já foi encerrada")
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

  it("o motorista só vê como entrega o cliente com SAP code e número white (a origem some)", async () => {
    const entregas = [
      { id: 1, cliente: "BASE RITMO", cidade: "JOINVILLE", sapcode: "", codewhite: "" },
      { id: 2, cliente: "WEG", cidade: "RIO DO SUL", sapcode: "2001", codewhite: "W10" },
    ]
    vi.mocked(prisma.viagem.findFirst).mockResolvedValue({ id: 7, entregas } as never)
    expect((await buscarMinhaViagem(FILIAL, ZE, 7))?.entregas.map((e) => e.id)).toEqual([2])

    vi.mocked(prisma.viagem.findMany).mockResolvedValue([{ id: 7, entregas }] as never)
    expect((await buscarMinhasViagens(FILIAL, ZE))[0].entregas.map((e) => e.id)).toEqual([2])
  })
})

describe("registrarChegadaCliente", () => {
  const saida = h("2026-10-02T07:00:00")
  const agora = h("2026-10-02T10:00:00")
  const entrega = (viagemParcial: Record<string, unknown> = {}, chegada: unknown = null) => ({
    id: 11,
    sapcode: "2001",
    codewhite: "W10",
    chegada,
    viagem: { id: 1, status: "INICIADA", produto: "OXIGENIO", kmInicial: 152300, horarioRealSaida: saida, ...viagemParcial },
  })
  const dados = (parcial: Record<string, unknown> = {}) => ({
    km: 152400,
    chegadaEm: h("2026-10-02T09:30:00"),
    medicao: "BALANCA" as const,
    nivelInicial: 1000,
    nivelFinal: 400,
    fatorCliente: null,
    polInicial: null,
    polFinal: null,
    ...parcial,
  })

  it("balança de oxigênio: grava km, hora e o total recalculado no servidor (600 kg × 0,754)", async () => {
    vi.mocked(prisma.entrega.findFirst).mockResolvedValue(entrega() as never)
    await registrarChegadaCliente(FILIAL, ZE, 1, 11, dados(), ator, agora)

    expect(prisma.entrega.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 11, viagemId: 1, viagem: { filialId: FILIAL, motoristaId: ZE, deletadoEm: null } } }),
    )
    const { create, update } = tx.chegadaEntrega.upsert.mock.calls[0][0]
    expect(create).toMatchObject({ entregaId: 11, km: 152400, medicao: "BALANCA", fator: 0.754, totalDescarregado: 452.4, usuarioId: "m1" })
    expect(update).not.toHaveProperty("entregaId")
  })

  it("biometano: guarda polegadas e m³; manômetro usa a conversão informada", async () => {
    vi.mocked(prisma.entrega.findFirst).mockResolvedValue(entrega({ produto: "BIOMETANO" }) as never)
    await registrarChegadaCliente(FILIAL, ZE, 1, 11, dados({ medicao: null, nivelInicial: 950, nivelFinal: 200, polInicial: 80, polFinal: 15 }), ator, agora)
    expect(tx.chegadaEntrega.upsert.mock.calls[0][0].create).toMatchObject({ medicao: null, polInicial: 80, polFinal: 15, totalDescarregado: 750, fator: null })

    vi.mocked(prisma.entrega.findFirst).mockResolvedValue(entrega() as never)
    await registrarChegadaCliente(FILIAL, ZE, 1, 11, dados({ medicao: "MANOMETRO", nivelInicial: 30, nivelFinal: 80, fatorCliente: 12.5 }), ator, agora)
    expect(tx.chegadaEntrega.upsert.mock.calls[1][0].create).toMatchObject({ medicao: "MANOMETRO", fator: 12.5, totalDescarregado: 625, polInicial: null })
  })

  it("recusa: entrega de outro motorista, viagem não iniciada, km menor que o inicial, hora no futuro ou antes da saída, leituras invertidas", async () => {
    vi.mocked(prisma.entrega.findFirst).mockResolvedValue(null)
    await expect(registrarChegadaCliente(FILIAL, ZE, 1, 11, dados(), ator, agora)).rejects.toThrow("Entrega não encontrada")

    // Origem (sem SAP code e número white) não é cliente: não recebe chegada.
    vi.mocked(prisma.entrega.findFirst).mockResolvedValue({ ...entrega(), sapcode: "", codewhite: "" } as never)
    await expect(registrarChegadaCliente(FILIAL, ZE, 1, 11, dados(), ator, agora)).rejects.toThrow("Entrega não encontrada")

    vi.mocked(prisma.entrega.findFirst).mockResolvedValue(entrega({ status: "ALOCADA" }) as never)
    vi.mocked(prisma.viagem.findFirst).mockResolvedValue(viagem() as never)
    await expect(registrarChegadaCliente(FILIAL, ZE, 1, 11, dados(), ator, agora)).rejects.toThrow("Inicie a viagem")

    vi.mocked(prisma.entrega.findFirst).mockResolvedValue(entrega() as never)
    await expect(registrarChegadaCliente(FILIAL, ZE, 1, 11, dados({ km: 152000 }), ator, agora)).rejects.toThrow("menor que o km inicial")
    await expect(registrarChegadaCliente(FILIAL, ZE, 1, 11, dados({ chegadaEm: h("2026-10-02T11:00:00") }), ator, agora)).rejects.toThrow("no futuro")
    await expect(registrarChegadaCliente(FILIAL, ZE, 1, 11, dados({ chegadaEm: h("2026-10-02T06:00:00") }), ator, agora)).rejects.toThrow("antes da saída")
    expect(tx.chegadaEntrega.upsert).not.toHaveBeenCalled()

    // Mesmo minuto da saída (o campo não tem segundos): aceita.
    vi.mocked(prisma.entrega.findFirst).mockResolvedValue(entrega({ horarioRealSaida: new Date(h("2026-10-02T09:30:00").getTime() + 40_000) }) as never)
    await registrarChegadaCliente(FILIAL, ZE, 1, 11, dados({ chegadaEm: h("2026-10-02T09:30:00") }), ator, agora)
    expect(tx.chegadaEntrega.upsert).toHaveBeenCalledTimes(1)
    tx.chegadaEntrega.upsert.mockClear()
    vi.mocked(prisma.entrega.findFirst).mockResolvedValue(entrega() as never)
    await expect(registrarChegadaCliente(FILIAL, ZE, 1, 11, dados({ nivelInicial: 100, nivelFinal: 400 }), ator, agora)).rejects.toThrow("maior que o inicial")
    expect(tx.chegadaEntrega.upsert).not.toHaveBeenCalled()
  })
})

describe("informarProblemaMecanico", () => {
  it("grava o texto e a hora; vazio = resolvido; viagem encerrada não aceita", async () => {
    const agora = h("2026-10-02T10:00:00")
    vi.mocked(prisma.viagem.findFirst).mockResolvedValue(viagem({ status: "INICIADA" }) as never)
    await informarProblemaMecanico(FILIAL, ZE, 1, "  Pneu furado na BR-101  ", ator, agora)
    expect(tx.viagem.updateMany).toHaveBeenCalledWith({
      where: { id: 1, filialId: FILIAL, motoristaId: ZE, deletadoEm: null, status: { in: ["CRIADA", "ALOCADA", "POSTERGADA", "INICIADA", "RETORNANDO"] } },
      data: { problemaMecanico: "Pneu furado na BR-101", problemaMecanicoEm: agora },
    })

    await informarProblemaMecanico(FILIAL, ZE, 1, "   ", ator, agora)
    expect(tx.viagem.updateMany.mock.lastCall?.[0].data).toEqual({ problemaMecanico: null, problemaMecanicoEm: null })

    vi.mocked(prisma.viagem.findFirst).mockResolvedValue(viagem({ status: "FINALIZADA" }) as never)
    await expect(informarProblemaMecanico(FILIAL, ZE, 1, "x", ator, agora)).rejects.toThrow("encerrada")
  })
})

describe("gravações do motorista com a viagem travada", () => {
  it("escalador encerrou/trocou o motorista entre a conferência e a gravação: despesa e chegada não gravam, e o motivo é explicado", async () => {
    tx.$queryRaw.mockResolvedValue([]) // a trava não acha a viagem dele em andamento
    vi.mocked(prisma.viagem.findFirst)
      .mockResolvedValueOnce(viagem({ status: "INICIADA" }) as never) // conferência
      .mockResolvedValueOnce(viagem({ status: "FINALIZADA" }) as never) // explicação
    await expect(adicionarMinhaDespesa(FILIAL, ZE, 1, { tipo: "PEDAGIO", valorCentavos: 890 }, ator)).rejects.toThrow("já foi encerrada")
    expect(tx.despesaViagem.create).not.toHaveBeenCalled()

    vi.mocked(prisma.entrega.findFirst).mockResolvedValue({
      id: 11, sapcode: "2001", codewhite: "W10", chegada: null, viagem: { id: 1, status: "INICIADA", produto: "OXIGENIO", kmInicial: 100, horarioRealSaida: null },
    } as never)
    vi.mocked(prisma.viagem.findFirst).mockResolvedValueOnce(viagem({ motoristaId: 99 }) as never)
    await expect(
      registrarChegadaCliente(FILIAL, ZE, 1, 11, { km: 150, chegadaEm: new Date(Date.now() - 60_000), medicao: "BALANCA", nivelInicial: 10, nivelFinal: 5 }, ator),
    ).rejects.toThrow("não está mais com você")
    expect(tx.chegadaEntrega.upsert).not.toHaveBeenCalled()
  })

  it("problema mecânico: viagem encerrada no meio-tempo não grava", async () => {
    vi.mocked(prisma.viagem.findFirst)
      .mockResolvedValueOnce(viagem({ status: "INICIADA" }) as never)
      .mockResolvedValueOnce(viagem({ status: "FINALIZADA" }) as never)
    tx.viagem.updateMany.mockResolvedValue({ count: 0 })
    await expect(informarProblemaMecanico(FILIAL, ZE, 1, "Pneu", ator)).rejects.toThrow("já foi encerrada")
    expect(tx.viagem.findUniqueOrThrow).not.toHaveBeenCalled()
  })
})

