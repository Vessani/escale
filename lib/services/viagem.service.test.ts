import { describe, expect, it, vi, beforeEach } from "vitest"
import type { EditarViagemInput, NovaViagemInput } from "@/lib/types/types"

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: vi.fn(),
    viagem: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    motorista: {
      findUnique: vi.fn(),
    },
  },
}))

vi.mock("@/lib/queries/motoristas", () => ({
  buscarMotoristasParaSelect: vi.fn(),
}))

vi.mock("@/lib/services/folga.service", () => ({
  reconciliarFolgaMotoristasNoDiaAtual: vi.fn(),
}))

vi.mock("@/lib/services/frota.service", () => ({
  calcularAvisoFrotaIndisponivel: vi.fn(),
  registrarOuAtualizarDisponibilidadeFrota: vi.fn(),
}))

import { prisma } from "@/lib/prisma"
import { buscarMotoristasParaSelect } from "@/lib/queries/motoristas"
import { reconciliarFolgaMotoristasNoDiaAtual } from "@/lib/services/folga.service"
import { calcularAvisoFrotaIndisponivel, registrarOuAtualizarDisponibilidadeFrota } from "@/lib/services/frota.service"
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
    jornadaRelatorioInicio: null,
    jornadaRelatorioFim: null,
    ...parcial,
  }
}

describe("viagem.service", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    usarTransacaoCom(criarTx())
    // Sem dado de jornada por padrão — calcularAvisoInterjornada retorna null.
    vi.mocked(prisma.motorista.findUnique).mockResolvedValue(null)
    // Sem conflito de frota por padrão — testado à parte em frota.service.test.ts.
    vi.mocked(calcularAvisoFrotaIndisponivel).mockResolvedValue(null)
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

    it("grava avisoInterjornada quando o motorista sugerido teve descanso insuficiente", async () => {
      const agora = new Date()
      const fimJornadaRecente = new Date(agora.getTime() - 2 * 60 * 60 * 1000) // só 2h de descanso

      vi.mocked(buscarMotoristasParaSelect).mockResolvedValue([
        criarMotoristaParaSelect({ jornadaRelatorioFim: fimJornadaRecente }),
      ] as never)

      const tx = criarTx()
      vi.mocked(tx.viagem.create).mockResolvedValue({ id: 102, motoristaId: 1 })
      usarTransacaoCom(tx)

      await criarViagemAvulsaService(criarViagemInput({ inicioPrevisto: agora.toISOString() }))

      const dadosCriados = vi.mocked(tx.viagem.create).mock.calls[0][0].data
      expect(dadosCriados.avisoInterjornada).toContain("Interjornada")
    })

    it("não grava avisoInterjornada quando o motorista não tem jornada de relatório importada", async () => {
      vi.mocked(buscarMotoristasParaSelect).mockResolvedValue([criarMotoristaParaSelect()] as never)

      const tx = criarTx()
      vi.mocked(tx.viagem.create).mockResolvedValue({ id: 103, motoristaId: 1 })
      usarTransacaoCom(tx)

      await criarViagemAvulsaService(criarViagemInput())

      const dadosCriados = vi.mocked(tx.viagem.create).mock.calls[0][0].data
      expect(dadosCriados.avisoInterjornada).toBeNull()
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
        // WEG (e não a variante do grupo AMBEV) porque só o nome dela é estável nos testes.
        criarViagemInput({ entregas: [{ dataEntrega: new Date().toISOString(), cliente: "WEG", cidade: "SP", uf: "SP", kg: 1, m3: 1, obs: "", sapcode: "", codewhite: "" }] }),
      )

      const dadosCriados = vi.mocked(tx.viagem.create).mock.calls[0][0].data
      expect(dadosCriados.integracaoExigida).toBe("WEG")
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

    it("grava avisoFrotaIndisponivel calculado e registra cavalo/carreta na mesma transação", async () => {
      vi.mocked(buscarMotoristasParaSelect).mockResolvedValue([criarMotoristaParaSelect()] as never)
      vi.mocked(calcularAvisoFrotaIndisponivel).mockResolvedValue("Frota 2064 só estará disponível a partir das 10:00 (em uso na viagem V-1).")

      const tx = criarTx()
      vi.mocked(tx.viagem.create).mockResolvedValue({ id: 99, motoristaId: 1 })
      usarTransacaoCom(tx)

      await criarViagemAvulsaService(criarViagemInput({ cavalo: "2064", carreta: "908" }))

      expect(calcularAvisoFrotaIndisponivel).toHaveBeenCalledWith("2064", "908", expect.any(Date))
      const dadosCriados = vi.mocked(tx.viagem.create).mock.calls[0][0].data
      expect(dadosCriados.avisoFrotaIndisponivel).toBe("Frota 2064 só estará disponível a partir das 10:00 (em uso na viagem V-1).")
      expect(registrarOuAtualizarDisponibilidadeFrota).toHaveBeenCalledWith(tx, "2064", "908", expect.any(Date))
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

    it("busca o motorista pelo id e grava avisoInterjornada quando o descanso dele é insuficiente", async () => {
      const agora = new Date()
      const fimJornadaRecente = new Date(agora.getTime() - 3 * 60 * 60 * 1000)
      vi.mocked(prisma.motorista.findUnique).mockResolvedValue({ jornadaRelatorioFim: fimJornadaRecente } as never)

      const tx = criarTx()
      vi.mocked(tx.viagem.create).mockResolvedValue({ id: 104, motoristaId: 7 })
      usarTransacaoCom(tx)

      await criarViagemComAlocacaoService(criarViagemInput({ inicioPrevisto: agora.toISOString() }), 7)

      expect(prisma.motorista.findUnique).toHaveBeenCalledWith({
        where: { id: 7 },
        select: { jornadaRelatorioFim: true },
      })
      const dadosCriados = vi.mocked(tx.viagem.create).mock.calls[0][0].data
      expect(dadosCriados.avisoInterjornada).toContain("Interjornada")
    })

    it("não consulta motorista nem gera aviso quando a viagem é criada sem motorista", async () => {
      const tx = criarTx()
      vi.mocked(tx.viagem.create).mockResolvedValue({ id: 105, motoristaId: null })
      usarTransacaoCom(tx)

      await criarViagemComAlocacaoService(criarViagemInput(), null)

      expect(prisma.motorista.findUnique).not.toHaveBeenCalled()
      const dadosCriados = vi.mocked(tx.viagem.create).mock.calls[0][0].data
      expect(dadosCriados.avisoInterjornada).toBeNull()
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

    it("recalcula avisoInterjornada com base no novo motorista quando motoristaId muda", async () => {
      vi.mocked(prisma.viagem.findUnique).mockResolvedValue({ status: "CRIADA", motoristaId: null } as never)
      const agora = new Date()
      const fimJornadaRecente = new Date(agora.getTime() - 4 * 60 * 60 * 1000)
      vi.mocked(prisma.motorista.findUnique).mockResolvedValue({ jornadaRelatorioFim: fimJornadaRecente } as never)

      const tx = criarTx()
      vi.mocked(tx.viagem.update).mockResolvedValue({ id: 1, motoristaId: 5 })
      usarTransacaoCom(tx)

      await editarViagemService(1, criarEdicaoInput({ motoristaId: 5, inicioPrevisto: agora.toISOString() }))

      expect(prisma.motorista.findUnique).toHaveBeenCalledWith({
        where: { id: 5 },
        select: { jornadaRelatorioFim: true },
      })
      const dados = vi.mocked(tx.viagem.update).mock.calls[0][0].data
      expect(dados.avisoInterjornada).toContain("Interjornada")
    })

    it("mantém o motorista atual (e recalcula o aviso pra ele) quando motoristaId não é enviado na edição", async () => {
      const agora = new Date()
      const fimJornadaRecente = new Date(agora.getTime() - 1 * 60 * 60 * 1000)
      vi.mocked(prisma.viagem.findUnique).mockResolvedValue({ status: "ALOCADA", motoristaId: 9 } as never)
      vi.mocked(prisma.motorista.findUnique).mockResolvedValue({ jornadaRelatorioFim: fimJornadaRecente } as never)

      const tx = criarTx()
      vi.mocked(tx.viagem.update).mockResolvedValue({ id: 1, motoristaId: 9 })
      usarTransacaoCom(tx)

      // motoristaId de propósito ausente do payload — dados.motoristaId fica undefined, não trocando o motorista.
      await editarViagemService(1, criarEdicaoInput({ inicioPrevisto: agora.toISOString() }))

      expect(prisma.motorista.findUnique).toHaveBeenCalledWith({
        where: { id: 9 },
        select: { jornadaRelatorioFim: true },
      })
      const dados = vi.mocked(tx.viagem.update).mock.calls[0][0].data
      expect(dados.avisoInterjornada).toContain("Interjornada")
    })

    it("verifica disponibilidade de frota e atualiza o cadastro com o novo fim previsto", async () => {
      vi.mocked(prisma.viagem.findUnique).mockResolvedValue({ status: "ALOCADA", motoristaId: 9 } as never)
      vi.mocked(calcularAvisoFrotaIndisponivel).mockResolvedValue("Frota 2064/908 só estará disponível a partir de 22/07/2026, 12:00.")

      const tx = criarTx()
      vi.mocked(tx.viagem.update).mockResolvedValue({ id: 1, motoristaId: 9 })
      usarTransacaoCom(tx)

      await editarViagemService(1, criarEdicaoInput({ cavalo: "2064", carreta: "908" }))

      expect(calcularAvisoFrotaIndisponivel).toHaveBeenCalledWith("2064", "908", expect.any(Date))
      const dados = vi.mocked(tx.viagem.update).mock.calls[0][0].data
      expect(dados.avisoFrotaIndisponivel).toBe("Frota 2064/908 só estará disponível a partir de 22/07/2026, 12:00.")
      expect(registrarOuAtualizarDisponibilidadeFrota).toHaveBeenCalledWith(tx, "2064", "908", expect.any(Date))
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
