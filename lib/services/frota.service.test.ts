import { describe, expect, it, vi, beforeEach } from "vitest"

vi.mock("@/lib/prisma", () => ({
  prisma: {
    frota: { findUnique: vi.fn(), findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
  },
}))

import { prisma } from "@/lib/prisma"
import {
  calcularAvisoFrotaIndisponivel,
  registrarOuAtualizarDisponibilidadeFrota,
  criarFrotaService,
  editarFrotaService,
  deletarFrotaService,
} from "@/lib/services/frota.service"

function criarTx() {
  return {
    frota: { upsert: vi.fn() },
  }
}

describe("calcularAvisoFrotaIndisponivel", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("retorna null pra código inválido (vazio ou placeholder '0000'), sem consultar o banco", async () => {
    const resultado = await calcularAvisoFrotaIndisponivel("0000", "908", new Date("2026-07-20T08:00:00"))

    expect(resultado).toBeNull()
    expect(prisma.frota.findUnique).not.toHaveBeenCalled()
  })

  it("retorna null quando o conjunto não está cadastrado", async () => {
    vi.mocked(prisma.frota.findUnique).mockResolvedValue(null)

    const resultado = await calcularAvisoFrotaIndisponivel("75", "908", new Date("2026-07-20T08:00:00"))

    expect(resultado).toBeNull()
    expect(prisma.frota.findUnique).toHaveBeenCalledWith({ where: { cavalo_carreta: { cavalo: "75", carreta: "908" } } })
  })

  it("retorna null quando disponivelEm já passou", async () => {
    vi.mocked(prisma.frota.findUnique).mockResolvedValue({
      id: 1, cavalo: "75", carreta: "908", disponivelEm: new Date("2026-07-19T10:00:00"),
    } as never)

    const resultado = await calcularAvisoFrotaIndisponivel("75", "908", new Date("2026-07-20T08:00:00"))

    expect(resultado).toBeNull()
  })

  it("avisa quando disponivelEm é depois do início da nova viagem", async () => {
    vi.mocked(prisma.frota.findUnique).mockResolvedValue({
      id: 1, cavalo: "75", carreta: "908", disponivelEm: new Date("2026-07-22T18:30:00"),
    } as never)

    const resultado = await calcularAvisoFrotaIndisponivel("75", "908", new Date("2026-07-20T08:00:00"))

    expect(resultado).toBe("Frota 75/908 só estará disponível a partir de 22/07/2026, 18:30.")
  })

  it("não avisa quando disponivelEm é exatamente igual ao início da nova viagem", async () => {
    const mesmoHorario = new Date("2026-07-20T08:00:00")
    vi.mocked(prisma.frota.findUnique).mockResolvedValue({
      id: 1, cavalo: "75", carreta: "908", disponivelEm: mesmoHorario,
    } as never)

    const resultado = await calcularAvisoFrotaIndisponivel("75", "908", mesmoHorario)

    expect(resultado).toBeNull()
  })
})

describe("registrarOuAtualizarDisponibilidadeFrota", () => {
  it("cadastra o conjunto com disponivelEm = fim da viagem quando ainda não existe", async () => {
    const tx = criarTx()
    const fim = new Date("2026-07-20T18:00:00")

    await registrarOuAtualizarDisponibilidadeFrota(tx as never, "75", "908", fim)

    expect(tx.frota.upsert).toHaveBeenCalledWith({
      where: { cavalo_carreta: { cavalo: "75", carreta: "908" } },
      update: { disponivelEm: fim, deletadoEm: null },
      create: { cavalo: "75", carreta: "908", disponivelEm: fim },
    })
  })

  it("não faz nada quando cavalo ou carreta é inválido (vazio/placeholder)", async () => {
    const tx = criarTx()

    await registrarOuAtualizarDisponibilidadeFrota(tx as never, "0000", "908", new Date())

    expect(tx.frota.upsert).not.toHaveBeenCalled()
  })
})

describe("criarFrotaService", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("cria o conjunto quando não há duplicidade ativa", async () => {
    vi.mocked(prisma.frota.findFirst).mockResolvedValue(null)
    vi.mocked(prisma.frota.create).mockResolvedValue({ id: 1 } as never)

    await criarFrotaService({ cavalo: "75", carreta: "908", disponivelEm: "2026-07-22T18:30" })

    expect(prisma.frota.create).toHaveBeenCalledWith({
      data: { cavalo: "75", carreta: "908", disponivelEm: new Date("2026-07-22T18:30") },
    })
  })

  it("lança erro quando já existe um conjunto ativo com a mesma dupla", async () => {
    vi.mocked(prisma.frota.findFirst).mockResolvedValue({ id: 1 } as never)

    await expect(criarFrotaService({ cavalo: "75", carreta: "908", disponivelEm: null })).rejects.toThrow(
      "Já existe um conjunto cadastrado com essa frota (cavalo/carreta).",
    )
    expect(prisma.frota.create).not.toHaveBeenCalled()
  })

  it("grava disponivelEm null quando não informado", async () => {
    vi.mocked(prisma.frota.findFirst).mockResolvedValue(null)
    vi.mocked(prisma.frota.create).mockResolvedValue({ id: 1 } as never)

    await criarFrotaService({ cavalo: "75", carreta: "908", disponivelEm: null })

    expect(prisma.frota.create).toHaveBeenCalledWith({
      data: { cavalo: "75", carreta: "908", disponivelEm: null },
    })
  })
})

describe("editarFrotaService", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("edita quando não conflita com outro conjunto ativo", async () => {
    vi.mocked(prisma.frota.findFirst).mockResolvedValue(null)
    vi.mocked(prisma.frota.update).mockResolvedValue({ id: 1 } as never)

    await editarFrotaService(1, { cavalo: "75", carreta: "908", disponivelEm: "2026-07-22T18:30" })

    expect(prisma.frota.findFirst).toHaveBeenCalledWith({
      where: { cavalo: "75", carreta: "908", deletadoEm: null, id: { not: 1 } },
    })
    expect(prisma.frota.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { cavalo: "75", carreta: "908", disponivelEm: new Date("2026-07-22T18:30") },
    })
  })

  it("lança erro quando a dupla já pertence a outro conjunto ativo", async () => {
    vi.mocked(prisma.frota.findFirst).mockResolvedValue({ id: 2 } as never)

    await expect(editarFrotaService(1, { cavalo: "75", carreta: "908", disponivelEm: null })).rejects.toThrow(
      "Já existe um conjunto cadastrado com essa frota (cavalo/carreta).",
    )
    expect(prisma.frota.update).not.toHaveBeenCalled()
  })
})

describe("deletarFrotaService", () => {
  it("marca deletadoEm", async () => {
    vi.mocked(prisma.frota.update).mockResolvedValue({ id: 1 } as never)

    await deletarFrotaService(1)

    const chamada = vi.mocked(prisma.frota.update).mock.calls[0][0]
    expect(chamada.where).toEqual({ id: 1 })
    expect(chamada.data.deletadoEm).toBeInstanceOf(Date)
  })
})
