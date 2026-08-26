import { describe, expect, it, vi, beforeEach } from "vitest"

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: vi.fn(),
    frota: { findUnique: vi.fn(), findFirst: vi.fn(), findUniqueOrThrow: vi.fn(), create: vi.fn(), update: vi.fn() },
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
    viagem: { findFirst: vi.fn() },
    registroAuditoria: { create: vi.fn() },
  }
}

type Tx = ReturnType<typeof criarTx>

/** Faz `prisma.$transaction(callback)` invocar `callback(tx)` — o cast contorna a assinatura real (sobrecarregada) do Prisma, que não importa aqui. */
function usarTransacaoCom(tx: Tx) {
  vi.mocked(prisma.$transaction).mockImplementation(((callback: (tx: Tx) => unknown) =>
    Promise.resolve(callback(tx))) as never)
}

describe("calcularAvisoFrotaIndisponivel", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("retorna null pra código inválido (vazio ou placeholder '0000'), sem consultar o banco", async () => {
    const resultado = await calcularAvisoFrotaIndisponivel(FILIAL_ID, "0000", "908", new Date("2026-07-20T08:00:00"))

    expect(resultado).toBeNull()
    expect(prisma.frota.findUnique).not.toHaveBeenCalled()
  })

  it("retorna null quando o conjunto não está cadastrado", async () => {
    vi.mocked(prisma.frota.findFirst).mockResolvedValue(null)

    const resultado = await calcularAvisoFrotaIndisponivel(FILIAL_ID, "75", "908", new Date("2026-07-20T08:00:00"))

    expect(resultado).toBeNull()
    expect(prisma.frota.findFirst).toHaveBeenCalledWith({ where: { cavalo: "75", carreta: "908", filialId: FILIAL_ID, deletadoEm: null } })
  })

  it("retorna null quando disponivelEm já passou", async () => {
    vi.mocked(prisma.frota.findFirst).mockResolvedValue({
      id: 1, cavalo: "75", carreta: "908", disponivelEm: new Date("2026-07-19T10:00:00"),
    } as never)

    const resultado = await calcularAvisoFrotaIndisponivel(FILIAL_ID, "75", "908", new Date("2026-07-20T08:00:00"))

    expect(resultado).toBeNull()
  })

  it("avisa quando disponivelEm é depois do início da nova viagem", async () => {
    vi.mocked(prisma.frota.findFirst).mockResolvedValue({
      id: 1, cavalo: "75", carreta: "908", disponivelEm: new Date("2026-07-22T18:30:00"),
    } as never)

    const resultado = await calcularAvisoFrotaIndisponivel(FILIAL_ID, "75", "908", new Date("2026-07-20T08:00:00"))

    expect(resultado).toBe("Frota 75/908 só estará disponível a partir de 22/07/2026, 18:30.")
  })

  it("não avisa quando disponivelEm é exatamente igual ao início da nova viagem", async () => {
    const mesmoHorario = new Date("2026-07-20T08:00:00")
    vi.mocked(prisma.frota.findFirst).mockResolvedValue({
      id: 1, cavalo: "75", carreta: "908", disponivelEm: mesmoHorario,
    } as never)

    const resultado = await calcularAvisoFrotaIndisponivel(FILIAL_ID, "75", "908", mesmoHorario)

    expect(resultado).toBeNull()
  })

  it("avisa quando o conjunto está marcado como em manutenção, mesmo sem disponivelEm no futuro", async () => {
    vi.mocked(prisma.frota.findFirst).mockResolvedValue({
      id: 1, cavalo: "75", carreta: "908", disponivelEm: null, emManutencao: true,
    } as never)

    const resultado = await calcularAvisoFrotaIndisponivel(FILIAL_ID, "75", "908", new Date("2026-07-20T08:00:00"))

    expect(resultado).toBe("Frota 75/908 está marcada como em manutenção.")
  })

  it("manutenção avisa mesmo com disponivelEm já passado (manual sempre vence)", async () => {
    vi.mocked(prisma.frota.findFirst).mockResolvedValue({
      id: 1, cavalo: "75", carreta: "908", disponivelEm: new Date("2026-07-19T10:00:00"), emManutencao: true,
    } as never)

    const resultado = await calcularAvisoFrotaIndisponivel(FILIAL_ID, "75", "908", new Date("2026-07-20T08:00:00"))

    expect(resultado).toBe("Frota 75/908 está marcada como em manutenção.")
  })
})

describe("sincronizarDisponibilidadeFrota", () => {
  it("não cadastra um conjunto novo, mesmo com viagem ativa — o cadastro de frota é fechado, só atualiza quem já existe", async () => {
    const tx = criarTx()
    vi.mocked(tx.frota.findFirst).mockResolvedValue(null)

    await sincronizarDisponibilidadeFrota(tx as never, FILIAL_ID, "75", "908")

    // Nem chega a olhar viagens ativas — sem conjunto cadastrado, não há o que sincronizar.
    expect(tx.viagem.findFirst).not.toHaveBeenCalled()
    expect(tx.frota.create).not.toHaveBeenCalled()
    expect(tx.frota.update).not.toHaveBeenCalled()
  })

  it("atualiza disponivelEm da dupla já cadastrada com o maior fim entre as viagens ativas, sem criar outra", async () => {
    const tx = criarTx()
    const fim = new Date("2026-07-20T18:00:00")
    vi.mocked(tx.viagem.findFirst).mockResolvedValue({ fimPrevisto: fim } as never)
    vi.mocked(tx.frota.findFirst).mockResolvedValue({ id: 7, cavalo: "75", carreta: "908" } as never)

    await sincronizarDisponibilidadeFrota(tx as never, FILIAL_ID, "75", "908")

    expect(tx.frota.update).toHaveBeenCalledWith({
      where: { id: 7, filialId: FILIAL_ID },
      data: { disponivelEm: fim },
    })
    expect(tx.frota.create).not.toHaveBeenCalled()
  })

  it("libera o conjunto (disponivelEm null) quando não sobra nenhuma viagem ativa — ex: a única foi cancelada", async () => {
    const tx = criarTx()
    vi.mocked(tx.viagem.findFirst).mockResolvedValue(null)
    vi.mocked(tx.frota.findFirst).mockResolvedValue({ id: 7, cavalo: "75", carreta: "908" } as never)

    await sincronizarDisponibilidadeFrota(tx as never, FILIAL_ID, "75", "908")

    expect(tx.frota.update).toHaveBeenCalledWith({
      where: { id: 7, filialId: FILIAL_ID },
      data: { disponivelEm: null },
    })
  })

  it("ignora viagens CANCELADA e FINALIZADA ao calcular a viagem ativa mais tardia", async () => {
    const tx = criarTx()
    vi.mocked(tx.viagem.findFirst).mockResolvedValue(null)
    vi.mocked(tx.frota.findFirst).mockResolvedValue({ id: 7 } as never)

    await sincronizarDisponibilidadeFrota(tx as never, FILIAL_ID, "75", "908")

    const chamada = vi.mocked(tx.viagem.findFirst).mock.calls[0][0] as { where: { status: { notIn: string[] } } }
    expect(chamada.where.status.notIn).toEqual(["CANCELADA", "FINALIZADA"])
  })

  it("não faz nada quando cavalo ou carreta é inválido (vazio/placeholder)", async () => {
    const tx = criarTx()

    await sincronizarDisponibilidadeFrota(tx as never, FILIAL_ID, "0000", "908")

    expect(tx.viagem.findFirst).not.toHaveBeenCalled()
    expect(tx.frota.findFirst).not.toHaveBeenCalled()
    expect(tx.frota.create).not.toHaveBeenCalled()
    expect(tx.frota.update).not.toHaveBeenCalled()
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
      data: { cavalo: "75", carreta: "908", disponivelEm: new Date("2026-07-22T21:30:00.000Z"), emManutencao: false, tipoProduto: null, filialId: FILIAL_ID },
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
      data: { cavalo: "75", carreta: "908", disponivelEm: null, emManutencao: false, tipoProduto: null, filialId: FILIAL_ID },
    })
  })

  it("grava emManutencao true quando marcado no cadastro", async () => {
    vi.mocked(prisma.frota.findFirst).mockResolvedValue(null)
    const tx = criarTx()
    vi.mocked(tx.frota.create).mockResolvedValue({ id: 1 })
    usarTransacaoCom(tx)

    await criarFrotaService(FILIAL_ID, { cavalo: "75", carreta: "908", disponivelEm: null, emManutencao: true }, ATOR)

    expect(tx.frota.create).toHaveBeenCalledWith({
      data: { cavalo: "75", carreta: "908", disponivelEm: null, emManutencao: true, tipoProduto: null, filialId: FILIAL_ID },
    })
  })

  it("grava tipoProduto quando informado no cadastro", async () => {
    vi.mocked(prisma.frota.findFirst).mockResolvedValue(null)
    const tx = criarTx()
    vi.mocked(tx.frota.create).mockResolvedValue({ id: 1 })
    usarTransacaoCom(tx)

    await criarFrotaService(FILIAL_ID, { cavalo: "75", carreta: "908", disponivelEm: null, tipoProduto: "CO2" }, ATOR)

    expect(tx.frota.create).toHaveBeenCalledWith({
      data: { cavalo: "75", carreta: "908", disponivelEm: null, emManutencao: false, tipoProduto: "CO2", filialId: FILIAL_ID },
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
      data: { cavalo: "75", carreta: "908", disponivelEm: new Date("2026-07-22T21:30:00.000Z"), emManutencao: false, tipoProduto: null },
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
