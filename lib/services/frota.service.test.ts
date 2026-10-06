import { afterEach, describe, expect, it, vi, beforeEach } from "vitest"

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: vi.fn(),
    frota: { findUnique: vi.fn(), findFirst: vi.fn(), findUniqueOrThrow: vi.fn(), create: vi.fn(), update: vi.fn() },
    viagem: { findMany: vi.fn() },
    manutencao: { findMany: vi.fn() },
  },
}))

import { prisma } from "@/lib/prisma"
import {
  calcularAvisoFrotaIndisponivel,
  sincronizarDisponibilidadeFrota,
  criarFrotaService,
  editarFrotaService,
  deletarFrotaService,
} from "@/lib/services/frota.service"
import type { Ator } from "@/lib/services/auditoria.service"

const FILIAL_ID = 1
const ATOR: Ator = { usuarioId: "u1", usuarioNome: "Ana" }

function criarTx() {
  return {
    frota: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
    viagem: { findMany: vi.fn(), update: vi.fn() },
    manutencao: { findMany: vi.fn().mockResolvedValue([]) },
    registroAuditoria: { create: vi.fn() },
  }
}

type Tx = ReturnType<typeof criarTx>

/** Faz `prisma.$transaction(callback)` invocar `callback(tx)` — o cast contorna a assinatura real (sobrecarregada) do Prisma, que não importa aqui. */
function usarTransacaoCom(tx: Tx) {
  vi.mocked(prisma.$transaction).mockImplementation(((callback: (tx: Tx) => unknown) => Promise.resolve(callback(tx))) as never)
}

describe("calcularAvisoFrotaIndisponivel", () => {
  const INICIO = new Date("2026-09-30T20:00:00-03:00")
  const FIM = new Date("2026-10-01T06:02:00-03:00")

  function viagem(id: number, numViagem: string, inicio: string, fim: string) {
    return { id, numViagem, inicioPrevisto: new Date(inicio), fimPrevisto: new Date(fim) }
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(prisma.viagem.findMany).mockResolvedValue([])
    vi.mocked(prisma.manutencao.findMany).mockResolvedValue([])
    // "Agora" fixo antes das manutenções de teste (30/09), senão o texto do
    // aviso mudaria conforme o dia em que o teste roda.
    vi.useFakeTimers({ toFake: ["Date"] })
    vi.setSystemTime(new Date("2026-09-29T12:00:00-03:00"))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("retorna null pra carreta inválida (vazia ou placeholder '0000'), sem consultar o banco", async () => {
    const resultado = await calcularAvisoFrotaIndisponivel(FILIAL_ID, "75", "0000", INICIO, FIM)

    expect(resultado).toBeNull()
    expect(prisma.frota.findFirst).not.toHaveBeenCalled()
  })

  it("retorna null quando o conjunto não está cadastrado", async () => {
    vi.mocked(prisma.frota.findFirst).mockResolvedValue(null)

    const resultado = await calcularAvisoFrotaIndisponivel(FILIAL_ID, "75", "908", INICIO, FIM)

    expect(resultado).toBeNull()
    expect(prisma.frota.findFirst).toHaveBeenCalledWith({
      where: { carreta: "908", filialId: FILIAL_ID, deletadoEm: null },
      orderBy: { atualizadoEm: "desc" },
    })
  })

  it("consulta conjunto e viagens só pela carreta, ignorando CANCELADA/FINALIZADA", async () => {
    vi.mocked(prisma.frota.findFirst).mockResolvedValue({ disponivelEm: null } as never)

    await calcularAvisoFrotaIndisponivel(FILIAL_ID, "9999", "908", INICIO, FIM)

    const chamada = vi.mocked(prisma.viagem.findMany).mock.calls[0][0] as { where: Record<string, unknown> }
    expect(chamada.where).not.toHaveProperty("cavalo")
    expect(chamada.where).toMatchObject({
      carreta: "908",
      filialId: FILIAL_ID,
      deletadoEm: null,
      status: { notIn: ["CANCELADA", "FINALIZADA"] },
    })
  })

  it("NÃO avisa quando a única viagem ativa da carreta é a própria viagem sendo editada (bug do 'Frota indisponível' ao editar)", async () => {
    vi.mocked(prisma.frota.findFirst).mockResolvedValue({ disponivelEm: FIM } as never)
    vi.mocked(prisma.viagem.findMany).mockResolvedValue([
      viagem(10, "922087", "2026-09-30T20:00:00-03:00", "2026-10-01T06:02:00-03:00"),
    ] as never)

    const resultado = await calcularAvisoFrotaIndisponivel(FILIAL_ID, "2025", "795", INICIO, FIM, 10)

    expect(resultado).toBeNull()
  })

  it("avisa quando OUTRA viagem ativa da carreta se sobrepõe, citando ela", async () => {
    vi.mocked(prisma.frota.findFirst).mockResolvedValue({ disponivelEm: null } as never)
    vi.mocked(prisma.viagem.findMany).mockResolvedValue([
      viagem(10, "922087", "2026-09-30T20:00:00-03:00", "2026-10-01T06:02:00-03:00"),
      viagem(11, "922100", "2026-09-30T12:00:00-03:00", "2026-09-30T22:30:00-03:00"),
    ] as never)

    const resultado = await calcularAvisoFrotaIndisponivel(FILIAL_ID, "2025", "795", INICIO, FIM, 10)

    expect(resultado).toBe("Frota 2025/795 em uso na viagem 922100 até 30/09/2026, 22:30.")
  })

  it("não avisa por causa de uma viagem futura da mesma carreta que não se sobrepõe", async () => {
    // disponivelEm = fim da viagem da semana que vem (maior fim entre as ativas)
    const fimSemanaQueVem = new Date("2026-10-08T06:00:00-03:00")
    vi.mocked(prisma.frota.findFirst).mockResolvedValue({ disponivelEm: fimSemanaQueVem } as never)
    vi.mocked(prisma.viagem.findMany).mockResolvedValue([
      viagem(12, "922300", "2026-10-07T20:00:00-03:00", "2026-10-08T06:00:00-03:00"),
    ] as never)

    const resultado = await calcularAvisoFrotaIndisponivel(FILIAL_ID, "2025", "795", INICIO, FIM)

    expect(resultado).toBeNull()
  })

  it("não avisa quando a outra viagem termina exatamente no início desta", async () => {
    vi.mocked(prisma.frota.findFirst).mockResolvedValue({ disponivelEm: INICIO } as never)
    vi.mocked(prisma.viagem.findMany).mockResolvedValue([
      viagem(11, "922100", "2026-09-30T10:00:00-03:00", "2026-09-30T20:00:00-03:00"),
    ] as never)

    const resultado = await calcularAvisoFrotaIndisponivel(FILIAL_ID, "2025", "795", INICIO, FIM)

    expect(resultado).toBeNull()
  })

  it("mantém a data manual do cadastro (disponivelEm que não é fim de nenhuma viagem ativa)", async () => {
    vi.mocked(prisma.frota.findFirst).mockResolvedValue({
      disponivelEm: new Date("2026-10-02T18:30:00-03:00"),
    } as never)

    const resultado = await calcularAvisoFrotaIndisponivel(FILIAL_ID, "75", "908", INICIO, FIM)

    expect(resultado).toBe("Frota 75/908 só estará disponível a partir de 02/10/2026, 18:30.")
  })

  function manutencao(parcial: Record<string, unknown>) {
    return {
      id: 1,
      veiculo: "CARRETA",
      codigo: "908",
      tipo: "PREVENTIVA",
      nivel: "B",
      responsavel: "WHITE_MARTINS",
      inicioPrevisto: new Date("2026-09-30T08:00:00-03:00"),
      fimPrevisto: new Date("2026-09-30T22:00:00-03:00"),
      inicioReal: null,
      fimReal: null,
      ...parcial,
    }
  }

  it("avisa quando a carreta tem manutenção no período da viagem (vence o resto, vale sem conjunto cadastrado)", async () => {
    vi.mocked(prisma.frota.findFirst).mockResolvedValue(null)
    vi.mocked(prisma.manutencao.findMany).mockResolvedValue([manutencao({})] as never)

    const resultado = await calcularAvisoFrotaIndisponivel(FILIAL_ID, "75", "908", INICIO, FIM)

    expect(resultado).toBe("Carreta 908 em manutenção (Preventiva B, White Martins) de 30/09/2026, 08:00 a 30/09/2026, 22:00.")
    const filtro = vi.mocked(prisma.manutencao.findMany).mock.calls[0][0] as { where: Record<string, unknown> }
    expect(filtro.where).toMatchObject({
      filialId: FILIAL_ID,
      deletadoEm: null,
      OR: [
        { veiculo: "CAVALO", codigo: { in: ["75"] } },
        { veiculo: "CARRETA", codigo: { in: ["908"] } },
      ],
    })
  })

  it("avisa pelo cavalo em manutenção, e não avisa por manutenção que termina antes da viagem", async () => {
    vi.mocked(prisma.frota.findFirst).mockResolvedValue({ disponivelEm: null } as never)
    vi.mocked(prisma.manutencao.findMany).mockResolvedValue([
      manutencao({ veiculo: "CAVALO", codigo: "75", tipo: "CORRETIVA", nivel: null, responsavel: "RITMO", fimPrevisto: null }),
    ] as never)
    expect(await calcularAvisoFrotaIndisponivel(FILIAL_ID, "75", "908", INICIO, FIM)).toMatch(
      /^Cavalo 75 em manutenção \(Corretiva, Ritmo\) desde/,
    )

    vi.mocked(prisma.manutencao.findMany).mockResolvedValue([
      manutencao({ fimReal: new Date("2026-09-30T19:00:00-03:00"), inicioReal: new Date("2026-09-30T08:00:00-03:00") }),
    ] as never)
    expect(await calcularAvisoFrotaIndisponivel(FILIAL_ID, "75", "908", INICIO, FIM)).toBeNull()
  })
})

describe("sincronizarDisponibilidadeFrota", () => {
  it("não cadastra um conjunto novo, mesmo com viagem ativa — o cadastro de frota é fechado, só atualiza quem já existe", async () => {
    const tx = criarTx()
    vi.mocked(tx.frota.findFirst).mockResolvedValue(null)
    vi.mocked(tx.viagem.findMany).mockResolvedValue([])

    await sincronizarDisponibilidadeFrota(tx as never, FILIAL_ID, "75", "908")

    expect(tx.frota.create).not.toHaveBeenCalled()
    expect(tx.frota.update).not.toHaveBeenCalled()
  })

  it("sem conjunto cadastrado, ainda grava o aviso de manutenção nas viagens da carreta", async () => {
    const tx = criarTx()
    vi.mocked(tx.frota.findFirst).mockResolvedValue(null)
    vi.mocked(tx.viagem.findMany).mockResolvedValue([
      {
        id: 1,
        numViagem: "A",
        cavalo: "75",
        inicioPrevisto: new Date("2026-07-20T08:00:00Z"),
        fimPrevisto: new Date("2026-07-20T18:00:00Z"),
        avisoFrotaIndisponivel: null,
      },
    ] as never)
    vi.mocked(tx.manutencao.findMany).mockResolvedValue([
      {
        id: 9,
        veiculo: "CARRETA",
        codigo: "908",
        tipo: "CORRETIVA",
        nivel: null,
        responsavel: "RITMO",
        inicioPrevisto: new Date("2026-07-20T10:00:00Z"),
        fimPrevisto: new Date("2026-07-20T12:00:00Z"),
        inicioReal: null,
        fimReal: null,
      },
    ] as never)

    await sincronizarDisponibilidadeFrota(tx as never, FILIAL_ID, "75", "908")

    expect(tx.viagem.update).toHaveBeenCalledWith({
      where: { id: 1, filialId: FILIAL_ID },
      data: { avisoFrotaIndisponivel: expect.stringContaining("Carreta 908 em manutenção (Corretiva, Ritmo)") },
    })
  })

  it("atualiza disponivelEm com o maior fim entre as viagens ativas da carreta", async () => {
    const tx = criarTx()
    vi.mocked(tx.frota.findFirst).mockResolvedValue({ id: 7, cavalo: "75", carreta: "908" } as never)
    vi.mocked(tx.viagem.findMany).mockResolvedValue([
      {
        id: 1,
        numViagem: "A",
        cavalo: "75",
        inicioPrevisto: new Date("2026-07-20T08:00:00Z"),
        fimPrevisto: new Date("2026-07-20T18:00:00Z"),
        avisoFrotaIndisponivel: null,
      },
      {
        id: 2,
        numViagem: "B",
        cavalo: "75",
        inicioPrevisto: new Date("2026-07-22T08:00:00Z"),
        fimPrevisto: new Date("2026-07-22T18:00:00Z"),
        avisoFrotaIndisponivel: null,
      },
    ] as never)

    await sincronizarDisponibilidadeFrota(tx as never, FILIAL_ID, "75", "908")

    expect(tx.frota.update).toHaveBeenCalledWith({
      where: { id: 7, filialId: FILIAL_ID },
      data: { disponivelEm: new Date("2026-07-22T18:00:00Z") },
    })
    // Nenhuma se sobrepõe: nada a regravar.
    expect(tx.viagem.update).not.toHaveBeenCalled()
  })

  it("libera o conjunto (disponivelEm null) quando não sobra nenhuma viagem ativa", async () => {
    const tx = criarTx()
    vi.mocked(tx.frota.findFirst).mockResolvedValue({ id: 7 } as never)
    vi.mocked(tx.viagem.findMany).mockResolvedValue([])

    await sincronizarDisponibilidadeFrota(tx as never, FILIAL_ID, "75", "908")

    expect(tx.frota.update).toHaveBeenCalledWith({
      where: { id: 7, filialId: FILIAL_ID },
      data: { disponivelEm: null },
    })
  })

  it("recalcula o aviso gravado nas viagens ativas da carreta: limpa o que não vale mais e marca sobreposições", async () => {
    const tx = criarTx()
    vi.mocked(tx.frota.findFirst).mockResolvedValue({ id: 7 } as never)
    vi.mocked(tx.viagem.findMany).mockResolvedValue([
      // Aviso antigo "preso" (ex: conflitava com uma viagem que foi cancelada).
      {
        id: 1,
        numViagem: "A",
        cavalo: "75",
        inicioPrevisto: new Date("2026-07-20T08:00:00Z"),
        fimPrevisto: new Date("2026-07-20T18:00:00Z"),
        avisoFrotaIndisponivel: "antigo",
      },
      {
        id: 2,
        numViagem: "B",
        cavalo: "75",
        inicioPrevisto: new Date("2026-07-22T08:00:00Z"),
        fimPrevisto: new Date("2026-07-22T18:00:00Z"),
        avisoFrotaIndisponivel: null,
      },
      {
        id: 3,
        numViagem: "C",
        cavalo: "75",
        inicioPrevisto: new Date("2026-07-22T12:00:00Z"),
        fimPrevisto: new Date("2026-07-22T20:00:00Z"),
        avisoFrotaIndisponivel: null,
      },
    ] as never)

    await sincronizarDisponibilidadeFrota(tx as never, FILIAL_ID, "75", "908")

    expect(tx.viagem.update).toHaveBeenCalledWith({ where: { id: 1, filialId: FILIAL_ID }, data: { avisoFrotaIndisponivel: null } })
    expect(tx.viagem.update).toHaveBeenCalledWith({
      where: { id: 2, filialId: FILIAL_ID },
      data: { avisoFrotaIndisponivel: expect.stringContaining("em uso na viagem C") },
    })
    expect(tx.viagem.update).toHaveBeenCalledWith({
      where: { id: 3, filialId: FILIAL_ID },
      data: { avisoFrotaIndisponivel: expect.stringContaining("em uso na viagem B") },
    })
  })

  it("não faz nada quando a carreta é inválida (vazia/placeholder)", async () => {
    const tx = criarTx()

    await sincronizarDisponibilidadeFrota(tx as never, FILIAL_ID, "75", "0000")

    expect(tx.viagem.findMany).not.toHaveBeenCalled()
    expect(tx.frota.findFirst).not.toHaveBeenCalled()
    expect(tx.frota.update).not.toHaveBeenCalled()
  })

  it("busca o conjunto só pela carreta, com orderBy determinístico quando há mais de um conjunto ativo", async () => {
    const tx = criarTx()
    vi.mocked(tx.frota.findFirst).mockResolvedValue({ id: 7 } as never)
    vi.mocked(tx.viagem.findMany).mockResolvedValue([])

    await sincronizarDisponibilidadeFrota(tx as never, FILIAL_ID, "75", "908")

    expect(tx.frota.findFirst).toHaveBeenCalledWith({
      where: { carreta: "908", filialId: FILIAL_ID, deletadoEm: null },
      orderBy: { atualizadoEm: "desc" },
    })
    const chamada = vi.mocked(tx.viagem.findMany).mock.calls[0][0] as { where: Record<string, unknown> }
    expect(chamada.where).not.toHaveProperty("cavalo")
    expect(chamada.where.carreta).toBe("908")
  })
})

describe("criarFrotaService", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("cria o conjunto quando não há duplicidade ativa", async () => {
    vi.mocked(prisma.frota.findFirst).mockResolvedValue(null)
    const tx = criarTx()
    vi.mocked(tx.frota.create).mockResolvedValue({ id: 1 })
    usarTransacaoCom(tx)

    await criarFrotaService(FILIAL_ID, { cavalo: "75", carreta: "908", disponivelEm: "2026-07-22T18:30" }, ATOR)

    // "18:30" sem timezone é interpretado como horário de Brasília (UTC-3) —
    // ver converterEntradaDeDataHora/parseDateTimeFromInput — não com
    // `new Date(texto)` puro, que dependeria do fuso de quem roda o teste.
    expect(tx.frota.create).toHaveBeenCalledWith({
      data: { cavalo: "75", carreta: "908", disponivelEm: new Date("2026-07-22T21:30:00.000Z"), tipoProduto: null, filialId: FILIAL_ID },
    })
    expect(tx.registroAuditoria.create).toHaveBeenCalledTimes(1)
  })

  it("lança erro quando já existe um conjunto ativo com a mesma dupla", async () => {
    vi.mocked(prisma.frota.findFirst).mockResolvedValue({ id: 1 } as never)

    await expect(criarFrotaService(FILIAL_ID, { cavalo: "75", carreta: "908", disponivelEm: null }, ATOR)).rejects.toThrow(
      "Já existe um conjunto cadastrado com essa frota (cavalo/carreta).",
    )
    expect(prisma.frota.create).not.toHaveBeenCalled()
  })

  it("grava disponivelEm null quando não informado", async () => {
    vi.mocked(prisma.frota.findFirst).mockResolvedValue(null)
    const tx = criarTx()
    vi.mocked(tx.frota.create).mockResolvedValue({ id: 1 })
    usarTransacaoCom(tx)

    await criarFrotaService(FILIAL_ID, { cavalo: "75", carreta: "908", disponivelEm: null }, ATOR)

    expect(tx.frota.create).toHaveBeenCalledWith({
      data: { cavalo: "75", carreta: "908", disponivelEm: null, tipoProduto: null, filialId: FILIAL_ID },
    })
  })

  it("grava tipoProduto quando informado no cadastro", async () => {
    vi.mocked(prisma.frota.findFirst).mockResolvedValue(null)
    const tx = criarTx()
    vi.mocked(tx.frota.create).mockResolvedValue({ id: 1 })
    usarTransacaoCom(tx)

    await criarFrotaService(FILIAL_ID, { cavalo: "75", carreta: "908", disponivelEm: null, tipoProduto: "CO2" }, ATOR)

    expect(tx.frota.create).toHaveBeenCalledWith({
      data: { cavalo: "75", carreta: "908", disponivelEm: null, tipoProduto: "CO2", filialId: FILIAL_ID },
    })
  })
})

describe("editarFrotaService", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(prisma.frota.findUniqueOrThrow).mockResolvedValue({ id: 1 } as never)
  })

  it("edita quando não conflita com outro conjunto ativo", async () => {
    vi.mocked(prisma.frota.findFirst).mockResolvedValue(null)
    const tx = criarTx()
    vi.mocked(tx.frota.update).mockResolvedValue({ id: 1 })
    usarTransacaoCom(tx)

    await editarFrotaService(FILIAL_ID, 1, { cavalo: "75", carreta: "908", disponivelEm: "2026-07-22T18:30" }, ATOR)

    expect(prisma.frota.findFirst).toHaveBeenCalledWith({
      where: { cavalo: "75", carreta: "908", filialId: FILIAL_ID, deletadoEm: null, id: { not: 1 } },
    })
    expect(tx.frota.update).toHaveBeenCalledWith({
      where: { id: 1, filialId: FILIAL_ID },
      data: { cavalo: "75", carreta: "908", disponivelEm: new Date("2026-07-22T21:30:00.000Z"), tipoProduto: null },
    })
    expect(tx.registroAuditoria.create).toHaveBeenCalledTimes(1)
  })

  it("lança erro quando a dupla já pertence a outro conjunto ativo", async () => {
    vi.mocked(prisma.frota.findFirst).mockResolvedValue({ id: 2 } as never)

    await expect(editarFrotaService(FILIAL_ID, 1, { cavalo: "75", carreta: "908", disponivelEm: null }, ATOR)).rejects.toThrow(
      "Já existe um conjunto cadastrado com essa frota (cavalo/carreta).",
    )
    expect(prisma.frota.update).not.toHaveBeenCalled()
  })
})

describe("deletarFrotaService", () => {
  it("marca deletadoEm", async () => {
    vi.mocked(prisma.frota.findUniqueOrThrow).mockResolvedValue({ id: 1 } as never)
    const tx = criarTx()
    vi.mocked(tx.frota.update).mockResolvedValue({ id: 1, deletadoEm: new Date() })
    usarTransacaoCom(tx)

    await deletarFrotaService(FILIAL_ID, 1, ATOR)

    const chamada = vi.mocked(tx.frota.update).mock.calls[0][0]
    expect(chamada.where).toEqual({ id: 1, filialId: FILIAL_ID })
    expect(chamada.data.deletadoEm).toBeInstanceOf(Date)
    expect(tx.registroAuditoria.create).toHaveBeenCalledTimes(1)
  })
})
