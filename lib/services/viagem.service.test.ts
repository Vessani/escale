import { describe, expect, it, vi, beforeEach } from "vitest"
import type { EditarViagemInput, NovaViagemInput } from "@/lib/types/types"

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: vi.fn(),
    viagem: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}))

vi.mock("@/lib/queries/motoristas", () => ({
  buscarMotoristasParaSelect: vi.fn(),
}))

vi.mock("@/lib/services/folga.service", () => ({
  reconciliarFolgaMotoristasNoDiaAtual: vi.fn(),
}))

import { prisma } from "@/lib/prisma"
import { buscarMotoristasParaSelect } from "@/lib/queries/motoristas"
import { reconciliarFolgaMotoristasNoDiaAtual } from "@/lib/services/folga.service"
import {
  criarViagemAvulsaService,
  criarViagemComAlocacaoService,
  editarViagemService,
  deletarViagemService,
  atualizarStatusViagemService,
  atualizarSaidaRealService,
} from "@/lib/services/viagem.service"

function criarTx() {
  return {
    viagem: {
      create: vi.fn(),
      update: vi.fn(),
    },
  }
}

type Tx = ReturnType<typeof criarTx>

/** Faz `prisma.$transaction(callback)` invocar `callback(tx)` — o cast contorna a assinatura real (sobrecarregada) do Prisma, que não importa aqui. */
function usarTransacaoCom(tx: Tx) {
  vi.mocked(prisma.$transaction).mockImplementation(((callback: (tx: Tx) => unknown) =>
    Promise.resolve(callback(tx))) as never)
}

function criarViagemInput(parcial: Partial<NovaViagemInput> = {}): NovaViagemInput {
  const agora = new Date()
  const fim = new Date(agora.getTime() + 60 * 60 * 1000)

  return {
    numViagem: "10045",
    carreta: "908",
    cavalo: "2064",
    tanque: "STCV-28",
    diasViagem: 1,
    inicioPrevisto: agora.toISOString(),
    fimPrevisto: fim.toISOString(),
    turno: "MANHA",
    entregas: [{ dataEntrega: agora.toISOString(), cliente: "Cliente Comum", cidade: "SP", uf: "SP", kg: 100, m3: 1, obs: "obs", sapcode: "", codewhite: "" }],
    ...parcial,
  }
}

function criarMotoristaParaSelect(parcial: Record<string, unknown> = {}) {
  return {
    id: 1,
    nome: "Ana",
    turno: "MANHA",
    diasTrabalhados: 1,
    integracao: [],
    viagens: [],
    registrosJornada: [],
    ...parcial,
  }
}

describe("viagem.service", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    usarTransacaoCom(criarTx())
  })

  describe("criarViagemAvulsaService", () => {
    it("sugere e aloca automaticamente o único motorista compatível", async () => {
      vi.mocked(buscarMotoristasParaSelect).mockResolvedValue([criarMotoristaParaSelect()] as never)

      const tx = criarTx()
      vi.mocked(tx.viagem.create).mockResolvedValue({ id: 99, motoristaId: 1 })
      usarTransacaoCom(tx)

      const resultado = await criarViagemAvulsaService(criarViagemInput())

      expect(resultado).toEqual({ id: 99, motoristaId: 1 })
      expect(tx.viagem.create).toHaveBeenCalledTimes(1)
      const dadosCriados = vi.mocked(tx.viagem.create).mock.calls[0][0].data
      expect(dadosCriados.motoristaId).toBe(1)
      expect(dadosCriados.status).toBe("ALOCADA")
      expect(reconciliarFolgaMotoristasNoDiaAtual).toHaveBeenCalledWith(tx, [1])
    })

    it("cria sem motorista (status CRIADA) quando ninguém é compatível", async () => {
      vi.mocked(buscarMotoristasParaSelect).mockResolvedValue([
        criarMotoristaParaSelect({ turno: "NOITE" }),
      ] as never)

      const tx = criarTx()
      vi.mocked(tx.viagem.create).mockResolvedValue({ id: 100, motoristaId: null })
      usarTransacaoCom(tx)

      await criarViagemAvulsaService(criarViagemInput({ turno: "MANHA" }))

      const dadosCriados = vi.mocked(tx.viagem.create).mock.calls[0][0].data
      expect(dadosCriados.motoristaId).toBeNull()
      expect(dadosCriados.status).toBe("CRIADA")
    })

    it("marca integracaoExigida quando alguma entrega é pra cliente com integração obrigatória", async () => {
      vi.mocked(buscarMotoristasParaSelect).mockResolvedValue([criarMotoristaParaSelect()] as never)

      const tx = criarTx()
      vi.mocked(tx.viagem.create).mockResolvedValue({ id: 101, motoristaId: null })
      usarTransacaoCom(tx)

      await criarViagemAvulsaService(
        criarViagemInput({ entregas: [{ dataEntrega: new Date().toISOString(), cliente: "AMBEV", cidade: "SP", uf: "SP", kg: 1, m3: 1, obs: "", sapcode: "", codewhite: "" }] }),
      )

      const dadosCriados = vi.mocked(tx.viagem.create).mock.calls[0][0].data
      expect(dadosCriados.integracaoExigida).toBe("AMBEV")
    })

    it("não seleciona automaticamente um motorista que já tem viagem conflitante registrada no banco (chamada separada anterior)", async () => {
      const agora = new Date()
      const inicioViagemExistente = agora
      const fimViagemExistente = new Date(agora.getTime() + 2 * 24 * 60 * 60 * 1000)

      // Simula o estado do banco depois que uma primeira "criarViagemAvulsaService"
      // já alocou esse motorista numa viagem — buscarMotoristasParaSelect, numa
      // chamada nova e separada, devolveria essa viagem na agenda dele.
      vi.mocked(buscarMotoristasParaSelect).mockResolvedValue([
        criarMotoristaParaSelect({
          viagens: [
            { id: 1, inicioPrevisto: inicioViagemExistente, fimPrevisto: fimViagemExistente, status: "ALOCADA", deletadoEm: null },
          ],
        }),
      ] as never)

      const tx = criarTx()
      vi.mocked(tx.viagem.create).mockResolvedValue({ id: 2, motoristaId: null })
      usarTransacaoCom(tx)

      // Nova viagem começa no meio do período da viagem existente do mesmo motorista.
      const inicioNova = new Date(inicioViagemExistente.getTime() + 24 * 60 * 60 * 1000)
      const fimNova = new Date(inicioNova.getTime() + 60 * 60 * 1000)

      await criarViagemAvulsaService(
        criarViagemInput({ inicioPrevisto: inicioNova.toISOString(), fimPrevisto: fimNova.toISOString() }),
      )

      const dadosCriados = vi.mocked(tx.viagem.create).mock.calls[0][0].data
      expect(dadosCriados.motoristaId).toBeNull()
      expect(dadosCriados.status).toBe("CRIADA")
    })

    it("ainda seleciona o motorista quando a viagem anterior dele já terminou com descanso suficiente", async () => {
      const agora = new Date()
      const inicioViagemAntiga = new Date(agora.getTime() - 5 * 24 * 60 * 60 * 1000)
      const fimViagemAntiga = new Date(agora.getTime() - 3 * 24 * 60 * 60 * 1000)

      vi.mocked(buscarMotoristasParaSelect).mockResolvedValue([
        criarMotoristaParaSelect({
          viagens: [
            { id: 1, inicioPrevisto: inicioViagemAntiga, fimPrevisto: fimViagemAntiga, status: "ALOCADA", deletadoEm: null },
          ],
        }),
      ] as never)

      const tx = criarTx()
      vi.mocked(tx.viagem.create).mockResolvedValue({ id: 3, motoristaId: 1 })
      usarTransacaoCom(tx)

      await criarViagemAvulsaService(criarViagemInput())

      const dadosCriados = vi.mocked(tx.viagem.create).mock.calls[0][0].data
      expect(dadosCriados.motoristaId).toBe(1)
    })
  })

  describe("criarViagemComAlocacaoService", () => {
    it("usa o motoristaId informado sem consultar sugestão automática", async () => {
      const tx = criarTx()
      vi.mocked(tx.viagem.create).mockResolvedValue({ id: 102, motoristaId: 7 })
      usarTransacaoCom(tx)

      await criarViagemComAlocacaoService(criarViagemInput(), 7)

      expect(buscarMotoristasParaSelect).not.toHaveBeenCalled()
      const dadosCriados = vi.mocked(tx.viagem.create).mock.calls[0][0].data
      expect(dadosCriados.motoristaId).toBe(7)
      expect(dadosCriados.status).toBe("ALOCADA")
    })
  })

  describe("editarViagemService", () => {
    function criarEdicaoInput(parcial: Partial<EditarViagemInput> = {}): EditarViagemInput {
      return { ...criarViagemInput(), entregas: criarViagemInput().entregas, ...parcial }
    }

    it("lança 'Viagem não encontrada.' quando o id não existe", async () => {
      vi.mocked(prisma.viagem.findUnique).mockResolvedValue(null)

      await expect(editarViagemService(999, criarEdicaoInput())).rejects.toThrow("Viagem não encontrada.")
    })

    it("promove o status pra ALOCADA ao atribuir motorista numa viagem CRIADA", async () => {
      vi.mocked(prisma.viagem.findUnique).mockResolvedValue({ status: "CRIADA", motoristaId: null } as never)

      const tx = criarTx()
      vi.mocked(tx.viagem.update).mockResolvedValue({ id: 1, motoristaId: 5 })
      usarTransacaoCom(tx)

      await editarViagemService(1, criarEdicaoInput({ motoristaId: 5 }))

      const dados = vi.mocked(tx.viagem.update).mock.calls[0][0].data
      expect(dados.status).toBe("ALOCADA")
      expect(dados.motoristaId).toBe(5)
      expect(reconciliarFolgaMotoristasNoDiaAtual).toHaveBeenCalledWith(tx, [null, 5])
    })

    it("não promove o status automaticamente quando a viagem já está FINALIZADA", async () => {
      vi.mocked(prisma.viagem.findUnique).mockResolvedValue({ status: "FINALIZADA", motoristaId: 3 } as never)

      const tx = criarTx()
      vi.mocked(tx.viagem.update).mockResolvedValue({ id: 1, motoristaId: 5 })
      usarTransacaoCom(tx)

      await editarViagemService(1, criarEdicaoInput({ motoristaId: 5 }))

      const dados = vi.mocked(tx.viagem.update).mock.calls[0][0].data
      expect(dados.status).toBe("FINALIZADA")
    })

    it("respeita o status explícito enviado, mesmo com troca de motorista", async () => {
      vi.mocked(prisma.viagem.findUnique).mockResolvedValue({ status: "CRIADA", motoristaId: null } as never)

      const tx = criarTx()
      vi.mocked(tx.viagem.update).mockResolvedValue({ id: 1, motoristaId: 5 })
      usarTransacaoCom(tx)

      await editarViagemService(1, criarEdicaoInput({ motoristaId: 5, status: "POSTERGADA" }))

      const dados = vi.mocked(tx.viagem.update).mock.calls[0][0].data
      expect(dados.status).toBe("POSTERGADA")
    })
  })

  describe("deletarViagemService", () => {
    it("marca deletadoEm e reconcilia a folga do motorista da viagem", async () => {
      const tx = criarTx()
      vi.mocked(tx.viagem.update).mockResolvedValue({ id: 1, motoristaId: 7 })
      usarTransacaoCom(tx)

      await deletarViagemService(1)

      const dados = vi.mocked(tx.viagem.update).mock.calls[0][0].data
      expect(dados.deletadoEm).toBeInstanceOf(Date)
      expect(reconciliarFolgaMotoristasNoDiaAtual).toHaveBeenCalledWith(tx, [7])
    })
  })

  describe("atualizarStatusViagemService", () => {
    it("lança erro quando o status não é informado", async () => {
      await expect(atualizarStatusViagemService(1, undefined)).rejects.toThrow("Status de viagem é obrigatório.")
    })

    it("atualiza o status e reconcilia a folga", async () => {
      const tx = criarTx()
      vi.mocked(tx.viagem.update).mockResolvedValue({ id: 1, motoristaId: 3 })
      usarTransacaoCom(tx)

      await atualizarStatusViagemService(1, "INICIADA")

      expect(tx.viagem.update).toHaveBeenCalledWith({ where: { id: 1 }, data: { status: "INICIADA" } })
      expect(reconciliarFolgaMotoristasNoDiaAtual).toHaveBeenCalledWith(tx, [3])
    })
  })

  describe("atualizarSaidaRealService", () => {
    it("grava horarioRealSaida e motivoAtraso diretamente, sem transação", async () => {
      vi.mocked(prisma.viagem.update).mockResolvedValue({ id: 1 } as never)
      const horario = new Date()

      await atualizarSaidaRealService(1, horario, "Trânsito")

      expect(prisma.viagem.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { horarioRealSaida: horario, motivoAtraso: "Trânsito" },
      })
      expect(prisma.$transaction).not.toHaveBeenCalled()
    })
  })
})
