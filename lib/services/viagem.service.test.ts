import { describe, expect, it, vi, beforeEach } from "vitest"
import type { EditarViagemInput, NovaViagemInput } from "@/lib/types/types"

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: vi.fn(),
    viagem: {
      findUnique: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    motorista: {
      findUnique: vi.fn(),
    },
    registroJornada: {
      findFirst: vi.fn(),
    },
  },
}))

vi.mock("@/lib/queries/motoristas", () => ({
  buscarMotoristasParaSelect: vi.fn(),
}))

vi.mock("@/lib/queries/clientes", () => ({
  buscarNomesClientesQueExigemIntegracao: vi.fn(),
}))

vi.mock("@/lib/services/folga.service", () => ({
  reconciliarFolgaMotoristasNoDiaAtual: vi.fn(),
}))

vi.mock("@/lib/services/frota.service", () => ({
  calcularAvisoFrotaIndisponivel: vi.fn(),
  calcularAvisoFrotaProduto: vi.fn(),
  sincronizarDisponibilidadeFrota: vi.fn(),
}))

import { prisma } from "@/lib/prisma"
import { buscarMotoristasParaSelect } from "@/lib/queries/motoristas"
import { buscarNomesClientesQueExigemIntegracao } from "@/lib/queries/clientes"
import { reconciliarFolgaMotoristasNoDiaAtual } from "@/lib/services/folga.service"
import { calcularAvisoFrotaIndisponivel, calcularAvisoFrotaProduto, sincronizarDisponibilidadeFrota } from "@/lib/services/frota.service"
import {
  criarViagemAvulsaService,
  criarViagemComAlocacaoService,
  editarViagemService,
  deletarViagemService,
  atualizarStatusViagemService,
  atualizarAlocacaoViagemService,
  atualizarSaidaRealService,
} from "@/lib/services/viagem.service"
import type { Ator } from "@/lib/services/auditoria.service"

const FILIAL_ID = 1
const ATOR: Ator = { usuarioId: "u1", usuarioNome: "Ana" }

function criarTx() {
  return {
    viagem: {
      create: vi.fn(),
      update: vi.fn(),
      findUnique: vi.fn(),
    },
    registroAuditoria: { create: vi.fn() },
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
    produto: "CO2",
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
    liberado: true,
    // Bate com o produto padrão de criarViagemInput ("CO2") — testes que
    // querem exercitar incompatibilidade de produto sobrescrevem isso.
    produtosAutorizados: ["CO2"],
    integracao: [],
    viagens: [],
    registrosJornada: [],
    jornadaRelatorioInicio: null,
    jornadaRelatorioFim: null,
    ...parcial,
  }
}

/**
 * Simula o histórico de jornada real de um motorista já carregado (mesmo
 * formato que buscarMotoristasParaSelect traz hoje) — usado pra testar o
 * aviso de interjornada a partir de encontrarFimJornadaAnterior, em vez do
 * agregado jornadaRelatorioFim (ver a correção de interjornada).
 */
function comFimJornadaAnterior(fim: Date) {
  return [{ data: fim, codigo: 1, fimJornada: fim }]
}

describe("viagem.service", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    usarTransacaoCom(criarTx())
    // Sem dado de jornada por padrão — calcularAvisoInterjornada retorna null.
    vi.mocked(prisma.registroJornada.findFirst).mockResolvedValue(null)
    // Sem conflito de frota por padrão — testado à parte em frota.service.test.ts.
    vi.mocked(calcularAvisoFrotaIndisponivel).mockResolvedValue(null)
    vi.mocked(calcularAvisoFrotaProduto).mockResolvedValue(null)
    // Bate com o produto padrão de criarViagemInput ("CO2") — testes que
    // querem exercitar o bloqueio de produto sobrescrevem isso.
    vi.mocked(prisma.motorista.findUnique).mockResolvedValue({ produtosAutorizados: ["CO2"] } as never)
    // Sem outra viagem ativa com o mesmo número por padrão — testado à parte abaixo.
    vi.mocked(prisma.viagem.findFirst).mockResolvedValue(null)
    // Snapshot "antes" da auditoria em deletarViagemService/atualizarSaidaRealService —
    // sobrescrito nos testes que se importam com o conteúdo exato.
    vi.mocked(prisma.viagem.findUniqueOrThrow).mockResolvedValue({} as never)
    // Mesmos clientes que antes viviam hardcoded em CLIENTES_COM_INTEGRACAO_OBRIGATORIA.
    vi.mocked(buscarNomesClientesQueExigemIntegracao).mockResolvedValue(
      new Set(["GEMP - AMBEV - BEBIDAS - N2L. (GRUPO AMB", "WEG"]),
    )
  })

  describe("criarViagemAvulsaService", () => {
    it("sugere e aloca automaticamente o único motorista compatível", async () => {
      vi.mocked(buscarMotoristasParaSelect).mockResolvedValue([criarMotoristaParaSelect()] as never)

      const tx = criarTx()
      vi.mocked(tx.viagem.create).mockResolvedValue({ id: 99, motoristaId: 1 })
      usarTransacaoCom(tx)

      const resultado = await criarViagemAvulsaService(FILIAL_ID, criarViagemInput(), ATOR)

      expect(resultado).toEqual({ id: 99, motoristaId: 1 })
      expect(tx.viagem.create).toHaveBeenCalledTimes(1)
      const dadosCriados = vi.mocked(tx.viagem.create).mock.calls[0][0].data
      expect(dadosCriados.motoristaId).toBe(1)
      expect(dadosCriados.status).toBe("ALOCADA")
      expect(dadosCriados.filialId).toBe(FILIAL_ID)
      expect(reconciliarFolgaMotoristasNoDiaAtual).toHaveBeenCalledWith(tx, [1], expect.anything())
    })

    it("grava avisoInterjornada quando o motorista sugerido teve descanso insuficiente", async () => {
      const agora = new Date()
      const fimJornadaRecente = new Date(agora.getTime() - 2 * 60 * 60 * 1000) // só 2h de descanso

      vi.mocked(buscarMotoristasParaSelect).mockResolvedValue([
        criarMotoristaParaSelect({ registrosJornada: comFimJornadaAnterior(fimJornadaRecente) }),
      ] as never)

      const tx = criarTx()
      vi.mocked(tx.viagem.create).mockResolvedValue({ id: 102, motoristaId: 1 })
      usarTransacaoCom(tx)

      await criarViagemAvulsaService(FILIAL_ID, criarViagemInput({ inicioPrevisto: agora.toISOString() }), ATOR)

      const dadosCriados = vi.mocked(tx.viagem.create).mock.calls[0][0].data
      expect(dadosCriados.avisoInterjornada).toContain("Interjornada")
    })

    it("não grava avisoInterjornada quando o motorista não tem jornada de relatório importada", async () => {
      vi.mocked(buscarMotoristasParaSelect).mockResolvedValue([criarMotoristaParaSelect()] as never)

      const tx = criarTx()
      vi.mocked(tx.viagem.create).mockResolvedValue({ id: 103, motoristaId: 1 })
      usarTransacaoCom(tx)

      await criarViagemAvulsaService(FILIAL_ID, criarViagemInput(), ATOR)

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

      await criarViagemAvulsaService(FILIAL_ID, criarViagemInput({ turno: "MANHA" }), ATOR)

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
        FILIAL_ID,
        // WEG (e não a variante do grupo AMBEV) porque só o nome dela é estável nos testes.
        criarViagemInput({ entregas: [{ dataEntrega: new Date().toISOString(), cliente: "WEG", cidade: "SP", uf: "SP", kg: 1, m3: 1, obs: "", sapcode: "", codewhite: "" }] }),
        ATOR,
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
        FILIAL_ID,
        criarViagemInput({ inicioPrevisto: inicioNova.toISOString(), fimPrevisto: fimNova.toISOString() }),
        ATOR,
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

      await criarViagemAvulsaService(FILIAL_ID, criarViagemInput(), ATOR)

      const dadosCriados = vi.mocked(tx.viagem.create).mock.calls[0][0].data
      expect(dadosCriados.motoristaId).toBe(1)
    })

    it("grava avisoFrotaIndisponivel calculado e registra cavalo/carreta na mesma transação", async () => {
      vi.mocked(buscarMotoristasParaSelect).mockResolvedValue([criarMotoristaParaSelect()] as never)
      vi.mocked(calcularAvisoFrotaIndisponivel).mockResolvedValue("Frota 2064 só estará disponível a partir das 10:00 (em uso na viagem V-1).")

      const tx = criarTx()
      vi.mocked(tx.viagem.create).mockResolvedValue({ id: 99, motoristaId: 1 })
      usarTransacaoCom(tx)

      await criarViagemAvulsaService(FILIAL_ID, criarViagemInput({ cavalo: "2064", carreta: "908" }), ATOR)

      expect(calcularAvisoFrotaIndisponivel).toHaveBeenCalledWith(FILIAL_ID, "2064", "908", expect.any(Date))
      const dadosCriados = vi.mocked(tx.viagem.create).mock.calls[0][0].data
      expect(dadosCriados.avisoFrotaIndisponivel).toBe("Frota 2064 só estará disponível a partir das 10:00 (em uso na viagem V-1).")
      expect(sincronizarDisponibilidadeFrota).toHaveBeenCalledWith(tx, FILIAL_ID, "2064", "908")
    })
  })

  describe("criarViagemComAlocacaoService", () => {
    it("usa o motoristaId informado sem consultar sugestão automática", async () => {
      const tx = criarTx()
      vi.mocked(tx.viagem.create).mockResolvedValue({ id: 102, motoristaId: 7 })
      usarTransacaoCom(tx)

      await criarViagemComAlocacaoService(FILIAL_ID, criarViagemInput(), 7, ATOR)

      expect(buscarMotoristasParaSelect).not.toHaveBeenCalled()
      const dadosCriados = vi.mocked(tx.viagem.create).mock.calls[0][0].data
      expect(dadosCriados.motoristaId).toBe(7)
      expect(dadosCriados.status).toBe("ALOCADA")
    })

    it("busca o fim da jornada anterior pelo id do motorista e grava avisoInterjornada quando o descanso dele é insuficiente", async () => {
      const agora = new Date()
      const fimJornadaRecente = new Date(agora.getTime() - 3 * 60 * 60 * 1000)
      vi.mocked(prisma.registroJornada.findFirst).mockResolvedValue({ fimJornada: fimJornadaRecente } as never)

      const tx = criarTx()
      vi.mocked(tx.viagem.create).mockResolvedValue({ id: 104, motoristaId: 7 })
      usarTransacaoCom(tx)

      await criarViagemComAlocacaoService(FILIAL_ID, criarViagemInput({ inicioPrevisto: agora.toISOString() }), 7, ATOR)

      expect(prisma.registroJornada.findFirst).toHaveBeenCalledWith({
        where: {
          motoristaId: 7,
          motorista: { filialId: FILIAL_ID },
          fimJornada: { not: null, lt: expect.any(Date) },
        },
        orderBy: { fimJornada: "desc" },
        select: { fimJornada: true },
      })
      const dadosCriados = vi.mocked(tx.viagem.create).mock.calls[0][0].data
      expect(dadosCriados.avisoInterjornada).toContain("Interjornada")
    })

    it("não consulta jornada nem gera aviso quando a viagem é criada sem motorista", async () => {
      const tx = criarTx()
      vi.mocked(tx.viagem.create).mockResolvedValue({ id: 105, motoristaId: null })
      usarTransacaoCom(tx)

      await criarViagemComAlocacaoService(FILIAL_ID, criarViagemInput(), null, ATOR)

      expect(prisma.registroJornada.findFirst).not.toHaveBeenCalled()
      const dadosCriados = vi.mocked(tx.viagem.create).mock.calls[0][0].data
      expect(dadosCriados.avisoInterjornada).toBeNull()
    })

    it("recusa alocar manualmente (ex: revisão do lote importado) um motorista que não está autorizado pro produto da viagem", async () => {
      vi.mocked(prisma.motorista.findUnique).mockResolvedValue({ produtosAutorizados: ["NITROGENIO"] } as never)

      await expect(
        criarViagemComAlocacaoService(FILIAL_ID, criarViagemInput({ produto: "CO2" }), 7, ATOR),
      ).rejects.toThrow("Motorista não autorizado a carregar o produto desta viagem.")
      expect(prisma.motorista.findUnique).toHaveBeenCalledWith({ where: { id: 7 }, select: { produtosAutorizados: true } })
    })
  })

  describe("garantirNumViagemDisponivel (numViagem sem @unique global — ver comentário no schema)", () => {
    it("lança erro amigável ao criar com um número já usado por outra viagem ATIVA", async () => {
      vi.mocked(prisma.viagem.findFirst).mockResolvedValue({ id: 1 } as never)

      await expect(criarViagemComAlocacaoService(FILIAL_ID, criarViagemInput({ numViagem: "10045" }), null, ATOR)).rejects.toThrow(
        "Já existe uma viagem com este número.",
      )
      expect(prisma.viagem.findFirst).toHaveBeenCalledWith({
        where: { numViagem: "10045", filialId: FILIAL_ID, deletadoEm: null },
        select: { id: true },
      })
    })

    it("permite criar com um número que só pertence a uma viagem DELETADA (soft delete não bloqueia mais)", async () => {
      // findFirst já filtra deletadoEm: null — uma viagem deletada com o mesmo número não aparece aqui.
      vi.mocked(prisma.viagem.findFirst).mockResolvedValue(null)

      const tx = criarTx()
      vi.mocked(tx.viagem.create).mockResolvedValue({ id: 50, motoristaId: null })
      usarTransacaoCom(tx)

      await criarViagemComAlocacaoService(FILIAL_ID, criarViagemInput({ numViagem: "10045" }), null, ATOR)

      expect(tx.viagem.create).toHaveBeenCalledTimes(1)
    })
  })

  describe("editarViagemService", () => {
    function criarEdicaoInput(parcial: Partial<EditarViagemInput> = {}): EditarViagemInput {
      return { ...criarViagemInput(), entregas: criarViagemInput().entregas, ...parcial }
    }

    it("lança 'Viagem não encontrada.' quando o id não existe", async () => {
      vi.mocked(prisma.viagem.findUnique).mockResolvedValue(null)

      await expect(editarViagemService(FILIAL_ID, 999, criarEdicaoInput(), ATOR)).rejects.toThrow("Viagem não encontrada.")
    })

    it("lança erro amigável quando o número editado já pertence a OUTRA viagem ativa", async () => {
      vi.mocked(prisma.viagem.findUnique).mockResolvedValue({ status: "CRIADA", motoristaId: null, motoristaAcompanhanteId: null } as never)
      vi.mocked(prisma.viagem.findFirst).mockResolvedValue({ id: 2 } as never)

      await expect(editarViagemService(FILIAL_ID, 1, criarEdicaoInput({ numViagem: "10045" }), ATOR)).rejects.toThrow(
        "Já existe uma viagem com este número.",
      )
      expect(prisma.viagem.findFirst).toHaveBeenCalledWith({
        where: { numViagem: "10045", filialId: FILIAL_ID, deletadoEm: null, id: { not: 1 } },
        select: { id: true },
      })
    })

    it("não bloqueia salvar a própria viagem mantendo o mesmo número (exclui o próprio id da checagem)", async () => {
      vi.mocked(prisma.viagem.findUnique).mockResolvedValue({ status: "CRIADA", motoristaId: null, motoristaAcompanhanteId: null } as never)
      // findFirst já exclui id:1 da busca — a própria viagem não conta como conflito.
      vi.mocked(prisma.viagem.findFirst).mockResolvedValue(null)

      const tx = criarTx()
      vi.mocked(tx.viagem.update).mockResolvedValue({ id: 1, motoristaId: null, motoristaAcompanhanteId: null })
      usarTransacaoCom(tx)

      await editarViagemService(FILIAL_ID, 1, criarEdicaoInput({ numViagem: "10045" }), ATOR)

      expect(tx.viagem.update).toHaveBeenCalledTimes(1)
    })

    it("promove o status pra ALOCADA ao atribuir motorista numa viagem CRIADA", async () => {
      vi.mocked(prisma.viagem.findUnique).mockResolvedValue({ status: "CRIADA", motoristaId: null, motoristaAcompanhanteId: null } as never)

      const tx = criarTx()
      vi.mocked(tx.viagem.update).mockResolvedValue({ id: 1, motoristaId: 5, motoristaAcompanhanteId: null })
      usarTransacaoCom(tx)

      await editarViagemService(FILIAL_ID, 1, criarEdicaoInput({ motoristaId: 5 }), ATOR)

      const dados = vi.mocked(tx.viagem.update).mock.calls[0][0].data
      expect(dados.status).toBe("ALOCADA")
      expect(dados.motoristaId).toBe(5)
      expect(reconciliarFolgaMotoristasNoDiaAtual).toHaveBeenCalledWith(tx, [null, 5, null, null], expect.anything())
    })

    it("grava o motoristaAcompanhanteId e reconcilia a folga do antigo e do novo acompanhante", async () => {
      vi.mocked(prisma.viagem.findUnique).mockResolvedValue({ status: "ALOCADA", motoristaId: 5, motoristaAcompanhanteId: 8 } as never)

      const tx = criarTx()
      vi.mocked(tx.viagem.update).mockResolvedValue({ id: 1, motoristaId: 5, motoristaAcompanhanteId: 11 })
      usarTransacaoCom(tx)

      await editarViagemService(FILIAL_ID, 1, criarEdicaoInput({ motoristaId: 5, motoristaAcompanhanteId: 11 }), ATOR)

      const dados = vi.mocked(tx.viagem.update).mock.calls[0][0].data
      expect(dados.motoristaAcompanhanteId).toBe(11)
      expect(reconciliarFolgaMotoristasNoDiaAtual).toHaveBeenCalledWith(tx, [5, 5, 8, 11], expect.anything())
    })

    it("não promove o status automaticamente quando a viagem já está FINALIZADA", async () => {
      vi.mocked(prisma.viagem.findUnique).mockResolvedValue({ status: "FINALIZADA", motoristaId: 3 } as never)

      const tx = criarTx()
      vi.mocked(tx.viagem.update).mockResolvedValue({ id: 1, motoristaId: 5 })
      usarTransacaoCom(tx)

      await editarViagemService(FILIAL_ID, 1, criarEdicaoInput({ motoristaId: 5 }), ATOR)

      const dados = vi.mocked(tx.viagem.update).mock.calls[0][0].data
      expect(dados.status).toBe("FINALIZADA")
    })

    it("respeita o status explícito enviado, mesmo com troca de motorista", async () => {
      vi.mocked(prisma.viagem.findUnique).mockResolvedValue({ status: "CRIADA", motoristaId: null } as never)

      const tx = criarTx()
      vi.mocked(tx.viagem.update).mockResolvedValue({ id: 1, motoristaId: 5 })
      usarTransacaoCom(tx)

      await editarViagemService(FILIAL_ID, 1, criarEdicaoInput({ motoristaId: 5, status: "POSTERGADA" }), ATOR)

      const dados = vi.mocked(tx.viagem.update).mock.calls[0][0].data
      expect(dados.status).toBe("POSTERGADA")
    })

    it("recalcula avisoInterjornada com base no novo motorista quando motoristaId muda", async () => {
      vi.mocked(prisma.viagem.findUnique).mockResolvedValue({ status: "CRIADA", motoristaId: null } as never)
      const agora = new Date()
      const fimJornadaRecente = new Date(agora.getTime() - 4 * 60 * 60 * 1000)
      vi.mocked(prisma.registroJornada.findFirst).mockResolvedValue({ fimJornada: fimJornadaRecente } as never)

      const tx = criarTx()
      vi.mocked(tx.viagem.update).mockResolvedValue({ id: 1, motoristaId: 5 })
      usarTransacaoCom(tx)

      await editarViagemService(FILIAL_ID, 1, criarEdicaoInput({ motoristaId: 5, inicioPrevisto: agora.toISOString() }), ATOR)

      expect(prisma.registroJornada.findFirst).toHaveBeenCalledWith({
        where: {
          motoristaId: 5,
          motorista: { filialId: FILIAL_ID },
          fimJornada: { not: null, lt: expect.any(Date) },
        },
        orderBy: { fimJornada: "desc" },
        select: { fimJornada: true },
      })
      const dados = vi.mocked(tx.viagem.update).mock.calls[0][0].data
      expect(dados.avisoInterjornada).toContain("Interjornada")
    })

    it("mantém o motorista atual (e recalcula o aviso pra ele) quando motoristaId não é enviado na edição", async () => {
      const agora = new Date()
      const fimJornadaRecente = new Date(agora.getTime() - 1 * 60 * 60 * 1000)
      vi.mocked(prisma.viagem.findUnique).mockResolvedValue({ status: "ALOCADA", motoristaId: 9 } as never)
      vi.mocked(prisma.registroJornada.findFirst).mockResolvedValue({ fimJornada: fimJornadaRecente } as never)

      const tx = criarTx()
      vi.mocked(tx.viagem.update).mockResolvedValue({ id: 1, motoristaId: 9 })
      usarTransacaoCom(tx)

      // motoristaId de propósito ausente do payload — dados.motoristaId fica undefined, não trocando o motorista.
      await editarViagemService(FILIAL_ID, 1, criarEdicaoInput({ inicioPrevisto: agora.toISOString() }), ATOR)

      expect(prisma.registroJornada.findFirst).toHaveBeenCalledWith({
        where: {
          motoristaId: 9,
          motorista: { filialId: FILIAL_ID },
          fimJornada: { not: null, lt: expect.any(Date) },
        },
        orderBy: { fimJornada: "desc" },
        select: { fimJornada: true },
      })
      const dados = vi.mocked(tx.viagem.update).mock.calls[0][0].data
      expect(dados.avisoInterjornada).toContain("Interjornada")
    })

    it("verifica disponibilidade de frota e sincroniza o cadastro pra dupla atual", async () => {
      vi.mocked(prisma.viagem.findUnique).mockResolvedValue({ status: "ALOCADA", motoristaId: 9, cavalo: "2064", carreta: "908" } as never)
      vi.mocked(calcularAvisoFrotaIndisponivel).mockResolvedValue("Frota 2064/908 só estará disponível a partir de 22/07/2026, 12:00.")

      const tx = criarTx()
      vi.mocked(tx.viagem.update).mockResolvedValue({ id: 1, motoristaId: 9 })
      usarTransacaoCom(tx)

      await editarViagemService(FILIAL_ID, 1, criarEdicaoInput({ cavalo: "2064", carreta: "908" }), ATOR)

      expect(calcularAvisoFrotaIndisponivel).toHaveBeenCalledWith(FILIAL_ID, "2064", "908", expect.any(Date))
      const dados = vi.mocked(tx.viagem.update).mock.calls[0][0].data
      expect(dados.avisoFrotaIndisponivel).toBe("Frota 2064/908 só estará disponível a partir de 22/07/2026, 12:00.")
      expect(sincronizarDisponibilidadeFrota).toHaveBeenCalledWith(tx, FILIAL_ID, "2064", "908")
      // Cavalo/carreta não mudou — não deve mexer em nenhuma outra dupla.
      expect(sincronizarDisponibilidadeFrota).toHaveBeenCalledTimes(1)
    })

    it("ao trocar de cavalo/carreta, sincroniza também a dupla antiga (senão ela fica presa)", async () => {
      vi.mocked(prisma.viagem.findUnique).mockResolvedValue({ status: "ALOCADA", motoristaId: 9, cavalo: "2064", carreta: "908" } as never)

      const tx = criarTx()
      vi.mocked(tx.viagem.update).mockResolvedValue({ id: 1, motoristaId: 9 })
      usarTransacaoCom(tx)

      await editarViagemService(FILIAL_ID, 1, criarEdicaoInput({ cavalo: "9999", carreta: "8888" }), ATOR)

      expect(sincronizarDisponibilidadeFrota).toHaveBeenCalledWith(tx, FILIAL_ID, "9999", "8888")
      expect(sincronizarDisponibilidadeFrota).toHaveBeenCalledWith(tx, FILIAL_ID, "2064", "908")
      expect(sincronizarDisponibilidadeFrota).toHaveBeenCalledTimes(2)
    })

    it("recusa trocar o produto da viagem mantendo um motorista que não está autorizado pro produto novo", async () => {
      vi.mocked(prisma.viagem.findUnique).mockResolvedValue({ status: "ALOCADA", motoristaId: 9, motoristaAcompanhanteId: null } as never)
      vi.mocked(prisma.motorista.findUnique).mockResolvedValue({ produtosAutorizados: ["CO2"] } as never)

      // motoristaId de propósito ausente do payload — o motorista 9, já alocado, é mantido; só o produto muda.
      await expect(
        editarViagemService(FILIAL_ID, 1, criarEdicaoInput({ produto: "NITROGENIO" }), ATOR),
      ).rejects.toThrow("Motorista não autorizado a carregar o produto desta viagem.")
    })

    it("recusa alocar explicitamente, na própria edição, um motorista incompatível com o produto da viagem", async () => {
      vi.mocked(prisma.viagem.findUnique).mockResolvedValue({ status: "CRIADA", motoristaId: null, motoristaAcompanhanteId: null } as never)
      vi.mocked(prisma.motorista.findUnique).mockResolvedValue({ produtosAutorizados: [] } as never)

      await expect(
        editarViagemService(FILIAL_ID, 1, criarEdicaoInput({ motoristaId: 12, produto: "CO2" }), ATOR),
      ).rejects.toThrow("Motorista não autorizado a carregar o produto desta viagem.")
    })
  })

  describe("deletarViagemService", () => {
    it("marca deletadoEm e reconcilia a folga do motorista da viagem", async () => {
      const tx = criarTx()
      vi.mocked(tx.viagem.update).mockResolvedValue({ id: 1, motoristaId: 7, motoristaAcompanhanteId: null, cavalo: "2064", carreta: "908" })
      usarTransacaoCom(tx)

      await deletarViagemService(FILIAL_ID, 1, ATOR)

      const dados = vi.mocked(tx.viagem.update).mock.calls[0][0].data
      expect(dados.deletadoEm).toBeInstanceOf(Date)
      expect(reconciliarFolgaMotoristasNoDiaAtual).toHaveBeenCalledWith(tx, [7, null], expect.anything())
    })

    it("sincroniza a disponibilidade da frota — excluir a viagem pode liberar o conjunto", async () => {
      const tx = criarTx()
      vi.mocked(tx.viagem.update).mockResolvedValue({ id: 1, motoristaId: 7, motoristaAcompanhanteId: null, cavalo: "2064", carreta: "908" })
      usarTransacaoCom(tx)

      await deletarViagemService(FILIAL_ID, 1, ATOR)

      expect(sincronizarDisponibilidadeFrota).toHaveBeenCalledWith(tx, FILIAL_ID, "2064", "908")
    })
  })

  describe("atualizarStatusViagemService", () => {
    it("lança erro quando o status não é informado", async () => {
      await expect(atualizarStatusViagemService(FILIAL_ID, 1, undefined, ATOR)).rejects.toThrow("Status de viagem é obrigatório.")
    })

    it("lança 'Viagem não encontrada.' quando o id não existe", async () => {
      vi.mocked(prisma.viagem.findUnique).mockResolvedValue(null)

      await expect(atualizarStatusViagemService(FILIAL_ID, 999, "INICIADA", ATOR)).rejects.toThrow("Viagem não encontrada.")
    })

    it("atualiza o status e reconcilia a folga", async () => {
      vi.mocked(prisma.viagem.findUnique).mockResolvedValue({ status: "ALOCADA", cavalo: "2064", carreta: "908", produto: "CO2", motoristaId: 3 } as never)
      const tx = criarTx()
      vi.mocked(tx.viagem.update).mockResolvedValue({ id: 1, motoristaId: 3, motoristaAcompanhanteId: null, cavalo: "2064", carreta: "908" })
      usarTransacaoCom(tx)

      await atualizarStatusViagemService(FILIAL_ID, 1, "INICIADA", ATOR)

      expect(tx.viagem.update).toHaveBeenCalledWith({
        where: { id: 1, filialId: FILIAL_ID },
        data: { status: "INICIADA", canceladoEm: undefined },
      })
      expect(reconciliarFolgaMotoristasNoDiaAtual).toHaveBeenCalledWith(tx, [3, null], expect.anything())
    })

    it("cancelar a viagem sincroniza a frota — é o que libera o conjunto ao cancelar/finalizar", async () => {
      vi.mocked(prisma.viagem.findUnique).mockResolvedValue({ status: "ALOCADA", cavalo: "2064", carreta: "908", produto: "CO2", motoristaId: 3 } as never)
      const tx = criarTx()
      vi.mocked(tx.viagem.update).mockResolvedValue({ id: 1, motoristaId: 3, motoristaAcompanhanteId: null, cavalo: "2064", carreta: "908" })
      usarTransacaoCom(tx)

      await atualizarStatusViagemService(FILIAL_ID, 1, "CANCELADA", ATOR)

      expect(sincronizarDisponibilidadeFrota).toHaveBeenCalledWith(tx, FILIAL_ID, "2064", "908")
    })

    it("finalizar a viagem também sincroniza a frota", async () => {
      vi.mocked(prisma.viagem.findUnique).mockResolvedValue({ status: "INICIADA", cavalo: "2064", carreta: "908", produto: "CO2", motoristaId: 3 } as never)
      const tx = criarTx()
      vi.mocked(tx.viagem.update).mockResolvedValue({ id: 1, motoristaId: 3, motoristaAcompanhanteId: null, cavalo: "2064", carreta: "908" })
      usarTransacaoCom(tx)

      await atualizarStatusViagemService(FILIAL_ID, 1, "FINALIZADA", ATOR)

      expect(sincronizarDisponibilidadeFrota).toHaveBeenCalledWith(tx, FILIAL_ID, "2064", "908")
    })

    it("grava canceladoEm ao transicionar para CANCELADA", async () => {
      vi.mocked(prisma.viagem.findUnique).mockResolvedValue({ status: "ALOCADA", cavalo: "2064", carreta: "908", produto: "CO2", motoristaId: 3 } as never)
      const tx = criarTx()
      vi.mocked(tx.viagem.update).mockResolvedValue({ id: 1, motoristaId: 3, motoristaAcompanhanteId: null })
      usarTransacaoCom(tx)

      await atualizarStatusViagemService(FILIAL_ID, 1, "CANCELADA", ATOR)

      const dados = vi.mocked(tx.viagem.update).mock.calls[0][0].data
      expect(dados.canceladoEm).toBeInstanceOf(Date)
    })

    it("não renova canceladoEm quando a viagem já estava CANCELADA", async () => {
      vi.mocked(prisma.viagem.findUnique).mockResolvedValue({ status: "CANCELADA", cavalo: "2064", carreta: "908", produto: "CO2", motoristaId: 3 } as never)
      const tx = criarTx()
      vi.mocked(tx.viagem.update).mockResolvedValue({ id: 1, motoristaId: 3, motoristaAcompanhanteId: null })
      usarTransacaoCom(tx)

      await atualizarStatusViagemService(FILIAL_ID, 1, "CANCELADA", ATOR)

      const dados = vi.mocked(tx.viagem.update).mock.calls[0][0].data
      expect(dados.canceladoEm).toBeUndefined()
    })

    it("postergar (com novaData) recalcula avisoInterjornada/avisoFrotaIndisponivel/avisoFrotaProdutoIncompativel pra nova data — não deixa os avisos antigos 'presos'", async () => {
      vi.mocked(prisma.viagem.findUnique).mockResolvedValue({ status: "ALOCADA", cavalo: "2064", carreta: "908", produto: "CO2", motoristaId: 3 } as never)
      vi.mocked(calcularAvisoFrotaIndisponivel).mockResolvedValue("Frota 2064/908 só estará disponível a partir de 22/07/2026, 12:00.")
      vi.mocked(calcularAvisoFrotaProduto).mockResolvedValue("Frota 2064/908 está cadastrada para Nitrogênio, não CO2.")
      const tx = criarTx()
      vi.mocked(tx.viagem.update).mockResolvedValue({ id: 1, motoristaId: 3, motoristaAcompanhanteId: null, cavalo: "2064", carreta: "908" })
      usarTransacaoCom(tx)

      const novoInicio = new Date("2026-08-20T08:00:00")
      const novoFim = new Date("2026-08-21T08:00:00")
      await atualizarStatusViagemService(FILIAL_ID, 1, "POSTERGADA", ATOR, { inicioPrevisto: novoInicio, fimPrevisto: novoFim })

      expect(calcularAvisoFrotaIndisponivel).toHaveBeenCalledWith(FILIAL_ID, "2064", "908", novoInicio)
      expect(calcularAvisoFrotaProduto).toHaveBeenCalledWith(FILIAL_ID, "2064", "908", "CO2")
      const dados = vi.mocked(tx.viagem.update).mock.calls[0][0].data
      expect(dados.avisoFrotaIndisponivel).toBe("Frota 2064/908 só estará disponível a partir de 22/07/2026, 12:00.")
      expect(dados.avisoFrotaProdutoIncompativel).toBe("Frota 2064/908 está cadastrada para Nitrogênio, não CO2.")
    })

    it("sem novaData (cancelar/finalizar/iniciar), não recalcula os avisos — mantém o que já estava gravado", async () => {
      vi.mocked(prisma.viagem.findUnique).mockResolvedValue({ status: "ALOCADA", cavalo: "2064", carreta: "908", produto: "CO2", motoristaId: 3 } as never)
      const tx = criarTx()
      vi.mocked(tx.viagem.update).mockResolvedValue({ id: 1, motoristaId: 3, motoristaAcompanhanteId: null, cavalo: "2064", carreta: "908" })
      usarTransacaoCom(tx)

      await atualizarStatusViagemService(FILIAL_ID, 1, "INICIADA", ATOR)

      expect(calcularAvisoFrotaIndisponivel).not.toHaveBeenCalled()
      expect(calcularAvisoFrotaProduto).not.toHaveBeenCalled()
      const dados = vi.mocked(tx.viagem.update).mock.calls[0][0].data
      expect(dados.avisoFrotaIndisponivel).toBeUndefined()
      expect(dados.avisoFrotaProdutoIncompativel).toBeUndefined()
    })
  })

  describe("atualizarAlocacaoViagemService (alocação rápida do Dashboard)", () => {
    it("lança 'Viagem não encontrada.' quando o id não existe", async () => {
      vi.mocked(prisma.viagem.findUnique).mockResolvedValue(null)

      await expect(atualizarAlocacaoViagemService(FILIAL_ID, 999, { motoristaId: 5, motoristaAcompanhanteId: null }, ATOR)).rejects.toThrow(
        "Viagem não encontrada.",
      )
    })

    it("aloca o motorista compatível e promove o status pra ALOCADA", async () => {
      vi.mocked(prisma.viagem.findUnique).mockResolvedValue({
        status: "CRIADA",
        motoristaId: null,
        motoristaAcompanhanteId: null,
        inicioPrevisto: new Date(),
        produto: "CO2",
      } as never)
      vi.mocked(prisma.motorista.findUnique).mockResolvedValue({ produtosAutorizados: ["CO2"] } as never)
      const tx = criarTx()
      vi.mocked(tx.viagem.update).mockResolvedValue({ id: 1, motoristaId: 5, motoristaAcompanhanteId: null })
      usarTransacaoCom(tx)

      await atualizarAlocacaoViagemService(FILIAL_ID, 1, { motoristaId: 5, motoristaAcompanhanteId: null }, ATOR)

      const dados = vi.mocked(tx.viagem.update).mock.calls[0][0].data
      expect(dados.motoristaId).toBe(5)
      expect(dados.status).toBe("ALOCADA")
    })

    it("recusa alocar pelo dashboard um motorista que não está autorizado pro produto da viagem — mesmo bloqueio da tela de edição completa", async () => {
      vi.mocked(prisma.viagem.findUnique).mockResolvedValue({
        status: "CRIADA",
        motoristaId: null,
        motoristaAcompanhanteId: null,
        inicioPrevisto: new Date(),
        produto: "NITROGENIO",
      } as never)
      vi.mocked(prisma.motorista.findUnique).mockResolvedValue({ produtosAutorizados: ["CO2"] } as never)

      await expect(atualizarAlocacaoViagemService(FILIAL_ID, 1, { motoristaId: 5, motoristaAcompanhanteId: null }, ATOR)).rejects.toThrow(
        "Motorista não autorizado a carregar o produto desta viagem.",
      )
    })

    it("desalocar (motoristaId: null) nunca consulta compatibilidade de produto", async () => {
      vi.mocked(prisma.viagem.findUnique).mockResolvedValue({
        status: "ALOCADA",
        motoristaId: 5,
        motoristaAcompanhanteId: null,
        inicioPrevisto: new Date(),
        produto: "NITROGENIO",
      } as never)
      const tx = criarTx()
      vi.mocked(tx.viagem.update).mockResolvedValue({ id: 1, motoristaId: null, motoristaAcompanhanteId: null })
      usarTransacaoCom(tx)

      await atualizarAlocacaoViagemService(FILIAL_ID, 1, { motoristaId: null, motoristaAcompanhanteId: null }, ATOR)

      expect(prisma.motorista.findUnique).not.toHaveBeenCalled()
    })
  })

  describe("atualizarSaidaRealService", () => {
    it("grava horarioRealSaida e motivoAtraso dentro de uma transação (junto da auditoria)", async () => {
      const tx = criarTx()
      vi.mocked(tx.viagem.update).mockResolvedValue({ id: 1 })
      usarTransacaoCom(tx)
      const horario = new Date()

      await atualizarSaidaRealService(FILIAL_ID, 1, horario, "Trânsito", ATOR)

      expect(tx.viagem.update).toHaveBeenCalledWith({
        where: { id: 1, filialId: FILIAL_ID },
        data: { horarioRealSaida: horario, motivoAtraso: "Trânsito" },
      })
      expect(tx.registroAuditoria.create).toHaveBeenCalledTimes(1)
    })
  })
})
