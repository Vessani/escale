import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: vi.fn(),
    chegadaEntrega: { findFirst: vi.fn() },
    despesaViagem: { findFirst: vi.fn() },
    entrega: { findFirst: vi.fn() },
  },
}))
vi.mock("@/lib/services/auditoria.service", () => ({ registrarAuditoria: vi.fn() }))

import { prisma } from "@/lib/prisma"
import { registrarAuditoria } from "@/lib/services/auditoria.service"
import {
  apagarChegadaPeloEscalador,
  corrigirDespesaPeloEscalador,
  corrigirKmPeloEscalador,
  lancarDespesaPeloEscalador,
  removerDespesaPeloEscalador,
  salvarChegadaPeloEscalador,
} from "./correcao-registro.service"

const ator = { usuarioId: "u1", usuarioNome: "Alan" }
const h = (iso: string) => new Date(`${iso}-03:00`)

const tx = {
  $queryRaw: vi.fn(),
  viagem: { findFirst: vi.fn(), update: vi.fn() },
  chegadaEntrega: { delete: vi.fn(), findUnique: vi.fn(), upsert: vi.fn() },
  despesaViagem: { create: vi.fn(), findFirst: vi.fn(), update: vi.fn() },
}

function viagem(parcial: Record<string, unknown> = {}) {
  return {
    id: 5,
    numViagem: "922087",
    status: "FINALIZADA",
    produto: "OXIGENIO",
    kmInicial: 152300,
    kmFinal: 152780,
    horarioRealSaida: h("2026-10-02T07:00:00"),
    entregas: [{ chegada: { km: 152410 } }, { chegada: null }],
    trocas: [],
    ...parcial,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(prisma.$transaction).mockImplementation(((cb: (t: unknown) => unknown) => Promise.resolve(cb(tx))) as never)
  tx.viagem.findFirst.mockResolvedValue(viagem())
})

const auditoria = () => vi.mocked(registrarAuditoria).mock.calls[0][1]

describe("corrigirKmPeloEscalador", () => {
  it("viagem encerrada: corrige os dois km com a viagem travada e marca a correção no histórico", async () => {
    await expect(corrigirKmPeloEscalador(3, 5, { kmInicial: 152200, kmFinal: 152900 }, ator)).resolves.toEqual({ viagemId: 5 })
    expect(tx.$queryRaw).toHaveBeenCalled()
    expect(tx.viagem.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 5, filialId: 3, deletadoEm: null } }))
    expect(tx.viagem.update).toHaveBeenCalledWith({ where: { id: 5 }, data: { kmInicial: 152200, kmFinal: 152900 } })
    expect(auditoria()).toMatchObject({
      entidade: "Viagem",
      acao: "ATUALIZACAO",
      antes: { kmInicial: 152300, kmFinal: 152780 },
      depois: { kmInicial: 152200, kmFinal: 152900, _contexto: "Correção do escalador (viagem 922087) · km" },
    })
  })

  it("recusa: final menor que inicial, final em viagem em andamento, finalizada sem final, chegada fora do trecho, viagem que não saiu", async () => {
    await expect(corrigirKmPeloEscalador(3, 5, { kmInicial: 152300, kmFinal: 152000 }, ator)).rejects.toThrow("menor que o inicial")

    tx.viagem.findFirst.mockResolvedValueOnce(viagem({ status: "INICIADA", kmFinal: null }))
    await expect(corrigirKmPeloEscalador(3, 5, { kmInicial: 152300, kmFinal: 152400 }, ator)).rejects.toThrow("depois que a viagem é encerrada")

    await expect(corrigirKmPeloEscalador(3, 5, { kmInicial: 152300, kmFinal: null }, ator)).rejects.toThrow("informe o km final")

    // chegada no km 152.410: inicial acima dela ou final abaixo dela não fecham
    await expect(corrigirKmPeloEscalador(3, 5, { kmInicial: 152500, kmFinal: 152900 }, ator)).rejects.toThrow("km menor que 152500")
    await expect(corrigirKmPeloEscalador(3, 5, { kmInicial: 152300, kmFinal: 152400 }, ator)).rejects.toThrow("km maior que 152400")

    tx.viagem.findFirst.mockResolvedValueOnce(viagem({ status: "ALOCADA" }))
    await expect(corrigirKmPeloEscalador(3, 5, { kmInicial: 152300, kmFinal: null }, ator)).rejects.toThrow("já saiu")

    tx.viagem.findFirst.mockResolvedValueOnce(null)
    await expect(corrigirKmPeloEscalador(3, 5, { kmInicial: 152300, kmFinal: 152780 }, ator)).rejects.toThrow("não encontrada")

    expect(tx.viagem.update).not.toHaveBeenCalled()
  })
})

describe("despesas pelo escalador", () => {
  it("lança, corrige e apaga (com data de exclusão), tudo no histórico como correção", async () => {
    tx.despesaViagem.create.mockResolvedValue({ id: 9, viagemId: 5, tipo: "PEDAGIO", valorCentavos: 1250 })
    await lancarDespesaPeloEscalador(3, 5, { tipo: "PEDAGIO", valorCentavos: 1250 }, ator)
    expect(tx.despesaViagem.create).toHaveBeenCalledWith({ data: { viagemId: 5, tipo: "PEDAGIO", valorCentavos: 1250, usuarioId: "u1" } })
    expect(auditoria()).toMatchObject({ entidade: "DespesaViagem", acao: "CRIACAO", depois: { _contexto: "Correção do escalador (viagem 922087) · pedágio" } })

    vi.mocked(prisma.despesaViagem.findFirst).mockResolvedValue({ viagemId: 5 } as never)
    tx.despesaViagem.findFirst.mockResolvedValue({ id: 9, viagemId: 5, tipo: "PEDAGIO", valorCentavos: 1250 })
    tx.despesaViagem.update.mockResolvedValue({ id: 9, viagemId: 5, tipo: "PERNOITE", valorCentavos: 8000 })
    await corrigirDespesaPeloEscalador(3, 9, { tipo: "PERNOITE", valorCentavos: 8000 }, ator)
    expect(prisma.despesaViagem.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 9, deletadoEm: null, viagem: { filialId: 3, deletadoEm: null } } }),
    )
    expect(tx.despesaViagem.update).toHaveBeenCalledWith({ where: { id: 9 }, data: { tipo: "PERNOITE", valorCentavos: 8000 } })

    await removerDespesaPeloEscalador(3, 9, ator)
    expect(tx.despesaViagem.update).toHaveBeenLastCalledWith({ where: { id: 9 }, data: { deletadoEm: expect.any(Date) } })
    expect(vi.mocked(registrarAuditoria).mock.calls.at(-1)?.[1]).toMatchObject({ acao: "EXCLUSAO", antes: { id: 9 } })
  })

  it("recusa valor fora do limite e despesa de outra filial ou já apagada", async () => {
    await expect(lancarDespesaPeloEscalador(3, 5, { tipo: "PEDAGIO", valorCentavos: 0 }, ator)).rejects.toThrow("Informe um valor")
    await expect(lancarDespesaPeloEscalador(3, 5, { tipo: "PEDAGIO", valorCentavos: 1_000_001 }, ator)).rejects.toThrow("Informe um valor")

    vi.mocked(prisma.despesaViagem.findFirst).mockResolvedValue(null)
    await expect(removerDespesaPeloEscalador(3, 9, ator)).rejects.toThrow("não encontrado")

    // apagada entre a leitura e a trava
    vi.mocked(prisma.despesaViagem.findFirst).mockResolvedValue({ viagemId: 5 } as never)
    tx.despesaViagem.findFirst.mockResolvedValue(null)
    await expect(corrigirDespesaPeloEscalador(3, 9, { tipo: "PEDAGIO", valorCentavos: 100 }, ator)).rejects.toThrow("não encontrado")
    expect(tx.despesaViagem.update).not.toHaveBeenCalled()
  })
})

describe("salvarChegadaPeloEscalador", () => {
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
  const agora = h("2026-10-03T10:00:00")

  it("corrige com o total refeito no servidor, mesmo com a viagem encerrada", async () => {
    vi.mocked(prisma.entrega.findFirst).mockResolvedValue({ viagemId: 5, cliente: "WEG", sapcode: "2001", codewhite: "W10" } as never)
    tx.chegadaEntrega.findUnique.mockResolvedValue({ id: 3, km: 152410 })
    tx.chegadaEntrega.upsert.mockResolvedValue({ id: 3 })

    await salvarChegadaPeloEscalador(3, 21, dados(), ator, agora)
    const { create, update } = tx.chegadaEntrega.upsert.mock.calls[0][0]
    expect(create).toMatchObject({ entregaId: 21, km: 152400, fator: 0.754, totalDescarregado: 452.4, usuarioId: "u1" })
    expect(update).not.toHaveProperty("entregaId")
    expect(auditoria()).toMatchObject({ acao: "ATUALIZACAO", depois: { _contexto: "Correção do escalador (viagem 922087) · chegada em WEG" } })
  })

  it("recusa: origem (sem códigos), km acima do final, km abaixo do inicial", async () => {
    vi.mocked(prisma.entrega.findFirst).mockResolvedValue({ viagemId: 5, cliente: "BASE", sapcode: "", codewhite: "" } as never)
    await expect(salvarChegadaPeloEscalador(3, 21, dados(), ator, agora)).rejects.toThrow("Entrega não encontrada")

    vi.mocked(prisma.entrega.findFirst).mockResolvedValue({ viagemId: 5, cliente: "WEG", sapcode: "2001", codewhite: "W10" } as never)
    await expect(salvarChegadaPeloEscalador(3, 21, dados({ km: 152900 }), ator, agora)).rejects.toThrow("km final (152780)")
    await expect(salvarChegadaPeloEscalador(3, 21, dados({ km: 152000 }), ator, agora)).rejects.toThrow("menor que o km inicial")
    expect(tx.chegadaEntrega.upsert).not.toHaveBeenCalled()
  })
})

describe("apagarChegadaPeloEscalador", () => {
  it("só acha chegada de viagem da filial; apaga com a viagem travada e guarda o que era no histórico", async () => {
    vi.mocked(prisma.chegadaEntrega.findFirst).mockResolvedValue({
      id: 7, km: 152410, entrega: { cliente: "HOSPITAL", viagemId: 5, viagem: { numViagem: "922087" } },
    } as never)

    await expect(apagarChegadaPeloEscalador(3, 7, ator)).resolves.toEqual({ viagemId: 5 })

    expect(prisma.chegadaEntrega.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 7, entrega: { viagem: { filialId: 3, deletadoEm: null } } } }))
    expect(tx.$queryRaw).toHaveBeenCalled()
    expect(tx.chegadaEntrega.delete).toHaveBeenCalledWith({ where: { id: 7 } })
    expect(auditoria()).toMatchObject({
      entidade: "ChegadaEntrega", entidadeId: 7, acao: "EXCLUSAO", antes: { id: 7, km: 152410, _contexto: "Chegada em HOSPITAL (viagem 922087)" },
    })
  })

  it("chegada de outra filial (ou inexistente): não encontrada, nada apagado", async () => {
    vi.mocked(prisma.chegadaEntrega.findFirst).mockResolvedValue(null)
    await expect(apagarChegadaPeloEscalador(3, 7, ator)).rejects.toThrow("não encontrada")
    expect(tx.chegadaEntrega.delete).not.toHaveBeenCalled()
  })
})
