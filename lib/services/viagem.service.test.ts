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
      findFirst: vi.fn(),
    },
  },
}))

vi.mock("@/lib/queries/motoristas", () => ({
  buscarMotoristasParaSelect: vi.fn(),
}))

vi.mock("@/lib/queries/clientes", () => ({
  buscarNumerosSapQueExigemIntegracao: vi.fn(),
}))

vi.mock("@/lib/services/interjornada.service", () => ({
  recalcularAvisosInterjornada: vi.fn(),
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
import { buscarNumerosSapQueExigemIntegracao } from "@/lib/queries/clientes"
import { reconciliarFolgaMotoristasNoDiaAtual } from "@/lib/services/folga.service"
import { recalcularAvisosInterjornada } from "@/lib/services/interjornada.service"
import { calcularAvisoFrotaIndisponivel, calcularAvisoFrotaProduto, sincronizarDisponibilidadeFrota } from "@/lib/services/frota.service"
import {
  criarViagemAvulsaService,
  criarViagemComAlocacaoService,
  editarViagemService,
  deletarViagemService,
  atualizarStatusViagemService,
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
      updateMany: vi.fn(),
      findUnique: vi.fn(),
      findUniqueOrThrow: vi.fn(),
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
    tipo: "MOTORISTA" as const,
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

describe("viagem.service", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    usarTransacaoCom(criarTx())
    // Sem conflito de frota por padrão — testado à parte em frota.service.test.ts.
    vi.mocked(calcularAvisoFrotaIndisponivel).mockResolvedValue(null)
    vi.mocked(calcularAvisoFrotaProduto).mockResolvedValue(null)
    // Bate com o produto padrão de criarViagemInput ("CO2") — testes que
    // querem exercitar o bloqueio de produto sobrescrevem isso.
    vi.mocked(prisma.motorista.findFirst).mockResolvedValue({ produtosAutorizados: ["CO2"], tipo: "MOTORISTA" } as never)
    // Sem outra viagem ativa com o mesmo número por padrão — testado à parte abaixo.
    vi.mocked(prisma.viagem.findFirst).mockResolvedValue(null)
    // Snapshot "antes" da auditoria em deletarViagemService/atualizarSaidaRealService —
    // sobrescrito nos testes que se importam com o conteúdo exato.
    vi.mocked(prisma.viagem.findUniqueOrThrow).mockResolvedValue({} as never)
    // Mesmos clientes que antes viviam hardcoded em CLIENTES_COM_INTEGRACAO_OBRIGATORIA.
    vi.mocked(buscarNumerosSapQueExigemIntegracao).mockResolvedValue(
      new Set(["9981234", "4521087"]),
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

    it("recalcula o aviso de descanso do motorista sugerido dentro da mesma transação da criação", async () => {
      vi.mocked(buscarMotoristasParaSelect).mockResolvedValue([criarMotoristaParaSelect()] as never)

      const tx = criarTx()
      vi.mocked(tx.viagem.create).mockResolvedValue({ id: 102, motoristaId: 1 })
      usarTransacaoCom(tx)

      await criarViagemAvulsaService(FILIAL_ID, criarViagemInput(), ATOR)

      // O aviso não é mais calculado à parte na criação — sai do recálculo único.
      const dadosCriados = vi.mocked(tx.viagem.create).mock.calls[0][0].data
      expect(dadosCriados).not.toHaveProperty("avisoInterjornada")
      expect(recalcularAvisosInterjornada).toHaveBeenCalledWith(tx, FILIAL_ID, [1])
    })

    it("não grava finalizadoEm numa viagem criada em aberto", async () => {
      vi.mocked(buscarMotoristasParaSelect).mockResolvedValue([criarMotoristaParaSelect()] as never)

      const tx = criarTx()
      vi.mocked(tx.viagem.create).mockResolvedValue({ id: 103, motoristaId: 1 })
      usarTransacaoCom(tx)

      await criarViagemAvulsaService(FILIAL_ID, criarViagemInput(), ATOR)

      const dadosCriados = vi.mocked(tx.viagem.create).mock.calls[0][0].data
      expect(dadosCriados.finalizadoEm).toBeUndefined()
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
        criarViagemInput({ entregas: [{ dataEntrega: new Date().toISOString(), cliente: "WEG", cidade: "SP", uf: "SP", kg: 1, m3: 1, obs: "", sapcode: "4521087", codewhite: "" }] }),
        ATOR,
      )

      const dadosCriados = vi.mocked(tx.viagem.create).mock.calls[0][0].data
      // Grava o SAP Code da entrega que bateu — ver calcularIntegracaoExigida.
      expect(dadosCriados.integracaoExigida).toBe("4521087")
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

      // Viagem nova: sem id pra ignorar na checagem de sobreposição.
      expect(calcularAvisoFrotaIndisponivel).toHaveBeenCalledWith(FILIAL_ID, "2064", "908", expect.any(Date), expect.any(Date))
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

    it("com motorista, grava ALOCADA mesmo se o formulário mandou CRIADA", async () => {
      const tx = criarTx()
      vi.mocked(tx.viagem.create).mockResolvedValue({ id: 103, motoristaId: 7 })
      usarTransacaoCom(tx)

      await criarViagemComAlocacaoService(FILIAL_ID, { ...criarViagemInput(), status: "CRIADA" }, 7, ATOR)

      expect(vi.mocked(tx.viagem.create).mock.calls[0][0].data.status).toBe("ALOCADA")
    })

    it("recalcula o aviso de descanso do motorista escolhido dentro da transação", async () => {
      const tx = criarTx()
      vi.mocked(tx.viagem.create).mockResolvedValue({ id: 104, motoristaId: 7 })
      usarTransacaoCom(tx)

      await criarViagemComAlocacaoService(FILIAL_ID, criarViagemInput(), 7, ATOR)

      expect(recalcularAvisosInterjornada).toHaveBeenCalledWith(tx, FILIAL_ID, [7])
    })

    it("criada sem motorista, não grava aviso de descanso", async () => {
      const tx = criarTx()
      vi.mocked(tx.viagem.create).mockResolvedValue({ id: 105, motoristaId: null })
      usarTransacaoCom(tx)

      await criarViagemComAlocacaoService(FILIAL_ID, criarViagemInput(), null, ATOR)

      const dadosCriados = vi.mocked(tx.viagem.create).mock.calls[0][0].data
      expect(dadosCriados).not.toHaveProperty("avisoInterjornada")
      expect(recalcularAvisosInterjornada).toHaveBeenCalledWith(tx, FILIAL_ID, [null])
    })

    it("recusa alocar manualmente (ex: revisão do lote importado) um motorista que não está autorizado pro produto da viagem", async () => {
      vi.mocked(prisma.motorista.findFirst).mockResolvedValue({ produtosAutorizados: ["NITROGENIO"], tipo: "MOTORISTA" } as never)

      await expect(
        criarViagemComAlocacaoService(FILIAL_ID, criarViagemInput({ produto: "CO2" }), 7, ATOR),
      ).rejects.toThrow("Motorista não autorizado a carregar o produto desta viagem.")
      expect(prisma.motorista.findFirst).toHaveBeenCalledWith({
        where: { id: 7, filialId: FILIAL_ID, deletadoEm: null },
        select: { produtosAutorizados: true, tipo: true },
      })
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

    it("editar o início sem mexer no turno faz o turno acompanhar; turno trocado à mão vale", async () => {
      const tx = criarTx()
      vi.mocked(tx.viagem.update).mockResolvedValue({ id: 1, motoristaId: null })
      usarTransacaoCom(tx)
      const antes = { status: "CRIADA", turno: "NOITE", inicioPrevisto: new Date("2026-10-01T20:00:00-03:00"), motoristaId: null, motoristaAcompanhanteId: null }

      vi.mocked(prisma.viagem.findUnique).mockResolvedValue(antes as never)
      await editarViagemService(FILIAL_ID, 1, criarEdicaoInput({ turno: "NOITE", inicioPrevisto: "2026-10-02T09:00" }), ATOR)
      expect(vi.mocked(tx.viagem.update).mock.calls[0][0].data.turno).toBe("MANHA")

      await editarViagemService(FILIAL_ID, 1, criarEdicaoInput({ turno: "MANHA", inicioPrevisto: "2026-10-02T20:00" }), ATOR)
      expect(vi.mocked(tx.viagem.update).mock.calls[1][0].data.turno).toBe("MANHA")
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

    it("CRIADA enviada explicitamente com motorista vira ALOCADA (e ALOCADA sem motorista vira CRIADA)", async () => {
      const tx = criarTx()
      vi.mocked(tx.viagem.update).mockResolvedValue({ id: 1, motoristaId: 5 })
      usarTransacaoCom(tx)

      vi.mocked(prisma.viagem.findUnique).mockResolvedValue({ status: "CRIADA", motoristaId: null } as never)
      await editarViagemService(FILIAL_ID, 1, criarEdicaoInput({ motoristaId: 5, status: "CRIADA" }), ATOR)
      expect(vi.mocked(tx.viagem.update).mock.calls[0][0].data.status).toBe("ALOCADA")

      vi.mocked(prisma.viagem.findUnique).mockResolvedValue({ status: "ALOCADA", motoristaId: 5 } as never)
      await editarViagemService(FILIAL_ID, 1, criarEdicaoInput({ motoristaId: null, status: "ALOCADA" }), ATOR)
      expect(vi.mocked(tx.viagem.update).mock.calls[1][0].data.status).toBe("CRIADA")
    })

    it("recalcula o aviso de descanso do motorista antigo e do novo quando motoristaId muda", async () => {
      vi.mocked(prisma.viagem.findUnique).mockResolvedValue({ status: "ALOCADA", motoristaId: 4 } as never)

      const tx = criarTx()
      vi.mocked(tx.viagem.update).mockResolvedValue({ id: 1, motoristaId: 5 })
      usarTransacaoCom(tx)

      await editarViagemService(FILIAL_ID, 1, criarEdicaoInput({ motoristaId: 5 }), ATOR)

      const [txUsada, filial, motoristas] = vi.mocked(recalcularAvisosInterjornada).mock.calls[0]
      expect(txUsada).toBe(tx)
      expect(filial).toBe(FILIAL_ID)
      // O antigo pode ter ficado livre (próxima viagem dele perde o aviso); o novo ganhou essa viagem.
      expect(motoristas).toEqual(expect.arrayContaining([4, 5]))
    })

    it("mantém o motorista atual (e recalcula o aviso pra ele) quando motoristaId não é enviado na edição", async () => {
      vi.mocked(prisma.viagem.findUnique).mockResolvedValue({ status: "ALOCADA", motoristaId: 9 } as never)

      const tx = criarTx()
      vi.mocked(tx.viagem.update).mockResolvedValue({ id: 1, motoristaId: 9 })
      usarTransacaoCom(tx)

      // motoristaId de propósito ausente do payload — dados.motoristaId fica undefined, não trocando o motorista.
      await editarViagemService(FILIAL_ID, 1, criarEdicaoInput(), ATOR)

      const dados = vi.mocked(tx.viagem.update).mock.calls[0][0].data
      expect(dados).not.toHaveProperty("avisoInterjornada")
      expect(vi.mocked(recalcularAvisosInterjornada).mock.calls[0][2]).toContain(9)
    })

    it("desalocar na edição (motoristaId null) limpa o aviso de descanso da viagem", async () => {
      vi.mocked(prisma.viagem.findUnique).mockResolvedValue({ status: "ALOCADA", motoristaId: 9 } as never)

      const tx = criarTx()
      vi.mocked(tx.viagem.update).mockResolvedValue({ id: 1, motoristaId: null })
      usarTransacaoCom(tx)

      await editarViagemService(FILIAL_ID, 1, criarEdicaoInput({ motoristaId: null }), ATOR)

      const dados = vi.mocked(tx.viagem.update).mock.calls[0][0].data
      expect(dados.avisoInterjornada).toBeNull()
    })

    it("finalizar pela edição grava finalizadoEm", async () => {
      vi.mocked(prisma.viagem.findUnique).mockResolvedValue({ status: "INICIADA", motoristaId: 9 } as never)

      const tx = criarTx()
      vi.mocked(tx.viagem.update).mockResolvedValue({ id: 1, motoristaId: 9 })
      usarTransacaoCom(tx)

      await editarViagemService(FILIAL_ID, 1, criarEdicaoInput({ status: "FINALIZADA" }), ATOR)

      const dados = vi.mocked(tx.viagem.update).mock.calls[0][0].data
      expect(dados.finalizadoEm).toBeInstanceOf(Date)
    })

    it("verifica disponibilidade de frota e sincroniza o cadastro pra dupla atual", async () => {
      vi.mocked(prisma.viagem.findUnique).mockResolvedValue({ status: "ALOCADA", motoristaId: 9, cavalo: "2064", carreta: "908" } as never)
      vi.mocked(calcularAvisoFrotaIndisponivel).mockResolvedValue("Frota 2064/908 só estará disponível a partir de 22/07/2026, 12:00.")

      const tx = criarTx()
      vi.mocked(tx.viagem.update).mockResolvedValue({ id: 1, motoristaId: 9 })
      usarTransacaoCom(tx)

      await editarViagemService(FILIAL_ID, 1, criarEdicaoInput({ cavalo: "2064", carreta: "908" }), ATOR)

      // Edição: passa o próprio id, pra viagem não conflitar consigo mesma.
      expect(calcularAvisoFrotaIndisponivel).toHaveBeenCalledWith(FILIAL_ID, "2064", "908", expect.any(Date), expect.any(Date), 1)
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

    it("trocando só o cavalo (carreta igual), sincroniza uma vez só — a carreta é quem decide a frota agora", async () => {
      vi.mocked(prisma.viagem.findUnique).mockResolvedValue({ status: "ALOCADA", motoristaId: 9, cavalo: "2064", carreta: "908" } as never)

      const tx = criarTx()
      vi.mocked(tx.viagem.update).mockResolvedValue({ id: 1, motoristaId: 9 })
      usarTransacaoCom(tx)

      await editarViagemService(FILIAL_ID, 1, criarEdicaoInput({ cavalo: "9999", carreta: "908" }), ATOR)

      expect(sincronizarDisponibilidadeFrota).toHaveBeenCalledWith(tx, FILIAL_ID, "9999", "908")
      expect(sincronizarDisponibilidadeFrota).toHaveBeenCalledTimes(1)
    })

    it("recusa trocar o produto da viagem mantendo um motorista que não está autorizado pro produto novo", async () => {
      vi.mocked(prisma.viagem.findUnique).mockResolvedValue({ status: "ALOCADA", motoristaId: 9, motoristaAcompanhanteId: null } as never)
      vi.mocked(prisma.motorista.findFirst).mockResolvedValue({ produtosAutorizados: ["CO2"], tipo: "MOTORISTA" } as never)

      // motoristaId de propósito ausente do payload — o motorista 9, já alocado, é mantido; só o produto muda.
      await expect(
        editarViagemService(FILIAL_ID, 1, criarEdicaoInput({ produto: "NITROGENIO" }), ATOR),
      ).rejects.toThrow("Motorista não autorizado a carregar o produto desta viagem.")
    })

    it("recusa alocar explicitamente, na própria edição, um motorista incompatível com o produto da viagem", async () => {
      vi.mocked(prisma.viagem.findUnique).mockResolvedValue({ status: "CRIADA", motoristaId: null, motoristaAcompanhanteId: null } as never)
      vi.mocked(prisma.motorista.findFirst).mockResolvedValue({ produtosAutorizados: [], tipo: "MOTORISTA" } as never)

      await expect(
        editarViagemService(FILIAL_ID, 1, criarEdicaoInput({ motoristaId: 12, produto: "CO2" }), ATOR),
      ).rejects.toThrow("Motorista não autorizado a carregar o produto desta viagem.")
    })

    describe("garantirMotoristasValidos (motorista vindo do navegador não é confiável)", () => {
      it("recusa motorista de outra filial (ou excluído) — a busca é escopada pela filial da sessão", async () => {
        vi.mocked(prisma.viagem.findUnique).mockResolvedValue({ status: "CRIADA", motoristaId: null, motoristaAcompanhanteId: null } as never)
        vi.mocked(prisma.motorista.findFirst).mockResolvedValue(null)

        await expect(
          editarViagemService(FILIAL_ID, 1, criarEdicaoInput({ motoristaId: 99 }), ATOR),
        ).rejects.toThrow("Motorista não encontrado nesta filial.")
        expect(prisma.motorista.findFirst).toHaveBeenCalledWith({
          where: { id: 99, filialId: FILIAL_ID, deletadoEm: null },
          select: { produtosAutorizados: true, tipo: true },
        })
      })

      it("recusa colocar um motorista em treinamento como principal", async () => {
        vi.mocked(prisma.viagem.findUnique).mockResolvedValue({ status: "CRIADA", motoristaId: null, motoristaAcompanhanteId: null } as never)
        vi.mocked(prisma.motorista.findFirst).mockResolvedValue({ produtosAutorizados: ["CO2"], tipo: "TREINAMENTO" as const } as never)

        await expect(
          editarViagemService(FILIAL_ID, 1, criarEdicaoInput({ motoristaId: 12 }), ATOR),
        ).rejects.toThrow("Motorista em treinamento só pode ser alocado como acompanhante.")
      })

      it("não trava a edição de uma viagem cujo motorista já alocado voltou pra treinamento ou foi excluído depois", async () => {
        const tx = criarTx()
        vi.mocked(tx.viagem.update).mockResolvedValue({ id: 1, motoristaId: 9, motoristaAcompanhanteId: null })
        usarTransacaoCom(tx)
        vi.mocked(prisma.viagem.findUnique).mockResolvedValue({ status: "ALOCADA", motoristaId: 9, motoristaAcompanhanteId: null } as never)
        vi.mocked(prisma.motorista.findFirst).mockResolvedValue({ produtosAutorizados: ["CO2"], tipo: "TREINAMENTO" as const } as never)

        await editarViagemService(FILIAL_ID, 1, criarEdicaoInput({ motoristaId: 9 }), ATOR)

        // Motorista mantido: só a filial é exigida, não deletadoEm: null.
        expect(prisma.motorista.findFirst).toHaveBeenCalledWith({
          where: { id: 9, filialId: FILIAL_ID },
          select: { produtosAutorizados: true, tipo: true },
        })
      })

      it("recusa enchedor como principal e como acompanhante — enchedor não faz viagem", async () => {
        vi.mocked(prisma.viagem.findUnique).mockResolvedValue({ status: "ALOCADA", motoristaId: 5, motoristaAcompanhanteId: null, produto: "CO2" } as never)

        vi.mocked(prisma.motorista.findFirst).mockResolvedValue({ produtosAutorizados: ["CO2"], tipo: "ENCHEDOR" } as never)
        await expect(
          editarViagemService(FILIAL_ID, 1, criarEdicaoInput({ motoristaId: 20, motoristaAcompanhanteId: null }), ATOR),
        ).rejects.toThrow("Enchedor não faz viagem.")

        vi.mocked(prisma.motorista.findFirst)
          .mockResolvedValueOnce({ produtosAutorizados: ["CO2"], tipo: "MOTORISTA" } as never)
          .mockResolvedValueOnce({ produtosAutorizados: [], tipo: "ENCHEDOR" } as never)
        await expect(
          editarViagemService(FILIAL_ID, 1, criarEdicaoInput({ motoristaId: 5, motoristaAcompanhanteId: 20 }), ATOR),
        ).rejects.toThrow("Enchedor não faz viagem.")
      })

      it.each(["INSTRUTOR", "INTERNO"] as const)("aceita %s como principal quando escolhido à mão", async (tipo) => {
        const tx = criarTx()
        vi.mocked(tx.viagem.update).mockResolvedValue({ id: 1, motoristaId: 30, motoristaAcompanhanteId: null })
        usarTransacaoCom(tx)
        vi.mocked(prisma.viagem.findUnique).mockResolvedValue({ status: "CRIADA", motoristaId: null, motoristaAcompanhanteId: null, produto: "CO2" } as never)
        vi.mocked(prisma.motorista.findFirst).mockResolvedValue({ produtosAutorizados: ["CO2"], tipo } as never)

        await editarViagemService(FILIAL_ID, 1, criarEdicaoInput({ motoristaId: 30, motoristaAcompanhanteId: null }), ATOR)

        expect(tx.viagem.update).toHaveBeenCalled()
      })

      it("aceita motorista em treinamento como acompanhante, mas exige que seja da filial", async () => {
        vi.mocked(prisma.viagem.findUnique).mockResolvedValue({ status: "ALOCADA", motoristaId: 5, motoristaAcompanhanteId: null, produto: "CO2" } as never)
        vi.mocked(prisma.motorista.findFirst)
          .mockResolvedValueOnce({ produtosAutorizados: ["CO2"], tipo: "MOTORISTA" as const } as never)
          .mockResolvedValueOnce(null)

        await expect(
          editarViagemService(FILIAL_ID, 1, criarEdicaoInput({ motoristaId: 5, motoristaAcompanhanteId: 77 }), ATOR),
        ).rejects.toThrow("Motorista não encontrado nesta filial.")
        expect(prisma.motorista.findFirst).toHaveBeenLastCalledWith({
          where: { id: 77, filialId: FILIAL_ID, deletadoEm: null },
          select: { produtosAutorizados: true, tipo: true },
        })
      })
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
      // Sem essa viagem na agenda, a próxima do motorista pode perder o aviso de descanso.
      expect(recalcularAvisosInterjornada).toHaveBeenCalledWith(tx, FILIAL_ID, [7, null])
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

    it("pelo motorista: só grava se ainda for dele e no status esperado — despacho mexeu no meio, nada muda", async () => {
      vi.mocked(prisma.viagem.findUnique).mockResolvedValue({ status: "ALOCADA", cavalo: "2064", carreta: "908", produto: "CO2", motoristaId: 3 } as never)
      const tx = criarTx()
      vi.mocked(tx.viagem.updateMany).mockResolvedValue({ count: 1 })
      vi.mocked(tx.viagem.findUniqueOrThrow).mockResolvedValue({ id: 1, motoristaId: 3, motoristaAcompanhanteId: null, cavalo: "2064", carreta: "908" })
      usarTransacaoCom(tx)
      const condicao = { motoristaId: 3, statusEsperados: ["ALOCADA" as const], dados: { kmInicial: 100 } }

      await atualizarStatusViagemService(FILIAL_ID, 1, "INICIADA", ATOR, undefined, condicao)
      expect(tx.viagem.updateMany).toHaveBeenCalledWith({
        where: { id: 1, filialId: FILIAL_ID, deletadoEm: null, motoristaId: 3, status: { in: ["ALOCADA"] } },
        data: { status: "INICIADA", canceladoEm: undefined, kmInicial: 100 },
      })
      expect(tx.viagem.update).not.toHaveBeenCalled()

      vi.mocked(tx.viagem.updateMany).mockResolvedValue({ count: 0 })
      vi.mocked(reconciliarFolgaMotoristasNoDiaAtual).mockClear()
      await expect(atualizarStatusViagemService(FILIAL_ID, 1, "INICIADA", ATOR, undefined, condicao)).rejects.toMatchObject({ codigo: "VIAGEM_MUDOU" })
      expect(reconciliarFolgaMotoristasNoDiaAtual).not.toHaveBeenCalled()
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

    it("finalizar grava finalizadoEm e recalcula o aviso de descanso do motorista e do acompanhante — libera a próxima viagem deles", async () => {
      vi.mocked(prisma.viagem.findUnique).mockResolvedValue({ status: "INICIADA", cavalo: "2064", carreta: "908", produto: "CO2", motoristaId: 3 } as never)
      const tx = criarTx()
      vi.mocked(tx.viagem.update).mockResolvedValue({ id: 1, motoristaId: 3, motoristaAcompanhanteId: 8 })
      usarTransacaoCom(tx)

      await atualizarStatusViagemService(FILIAL_ID, 1, "FINALIZADA", ATOR)

      const dados = vi.mocked(tx.viagem.update).mock.calls[0][0].data
      expect(dados.finalizadoEm).toBeInstanceOf(Date)
      expect(recalcularAvisosInterjornada).toHaveBeenCalledWith(tx, FILIAL_ID, [3, 8])
    })

    it("não renova finalizadoEm quando a viagem já estava FINALIZADA", async () => {
      vi.mocked(prisma.viagem.findUnique).mockResolvedValue({ status: "FINALIZADA", cavalo: "2064", carreta: "908", produto: "CO2", motoristaId: 3 } as never)
      const tx = criarTx()
      vi.mocked(tx.viagem.update).mockResolvedValue({ id: 1, motoristaId: 3, motoristaAcompanhanteId: null })
      usarTransacaoCom(tx)

      await atualizarStatusViagemService(FILIAL_ID, 1, "FINALIZADA", ATOR)

      const dados = vi.mocked(tx.viagem.update).mock.calls[0][0].data
      expect(dados.finalizadoEm).toBeUndefined()
    })

    it("reabrir uma viagem finalizada limpa finalizadoEm — a finalização antiga deixa de liberar o motorista", async () => {
      vi.mocked(prisma.viagem.findUnique).mockResolvedValue({ status: "FINALIZADA", cavalo: "2064", carreta: "908", produto: "CO2", motoristaId: 3 } as never)
      const tx = criarTx()
      vi.mocked(tx.viagem.update).mockResolvedValue({ id: 1, motoristaId: 3, motoristaAcompanhanteId: null })
      usarTransacaoCom(tx)

      await atualizarStatusViagemService(FILIAL_ID, 1, "RETORNANDO", ATOR)

      const dados = vi.mocked(tx.viagem.update).mock.calls[0][0].data
      expect(dados.finalizadoEm).toBeNull()
    })

    it("postergar (com novaData) recalcula avisoFrotaIndisponivel/avisoFrotaProdutoIncompativel pra nova data — não deixa os avisos antigos 'presos'", async () => {
      vi.mocked(prisma.viagem.findUnique).mockResolvedValue({ status: "ALOCADA", cavalo: "2064", carreta: "908", produto: "CO2", motoristaId: 3 } as never)
      vi.mocked(calcularAvisoFrotaIndisponivel).mockResolvedValue("Frota 2064/908 só estará disponível a partir de 22/07/2026, 12:00.")
      vi.mocked(calcularAvisoFrotaProduto).mockResolvedValue("Frota 2064/908 está cadastrada para Nitrogênio, não CO2.")
      const tx = criarTx()
      vi.mocked(tx.viagem.update).mockResolvedValue({ id: 1, motoristaId: 3, motoristaAcompanhanteId: null, cavalo: "2064", carreta: "908" })
      usarTransacaoCom(tx)

      const novoInicio = new Date("2026-08-20T08:00:00")
      const novoFim = new Date("2026-08-21T08:00:00")
      await atualizarStatusViagemService(FILIAL_ID, 1, "POSTERGADA", ATOR, { inicioPrevisto: novoInicio, fimPrevisto: novoFim })

      expect(calcularAvisoFrotaIndisponivel).toHaveBeenCalledWith(FILIAL_ID, "2064", "908", novoInicio, novoFim, 1)
      expect(calcularAvisoFrotaProduto).toHaveBeenCalledWith(FILIAL_ID, "2064", "908", "CO2")
      const dados = vi.mocked(tx.viagem.update).mock.calls[0][0].data
      expect(dados.avisoFrotaIndisponivel).toBe("Frota 2064/908 só estará disponível a partir de 22/07/2026, 12:00.")
      expect(dados.avisoFrotaProdutoIncompativel).toBe("Frota 2064/908 está cadastrada para Nitrogênio, não CO2.")
    })

    it("postergar da noite pro dia troca o turno pelo novo horário de início", async () => {
      vi.mocked(prisma.viagem.findUnique).mockResolvedValue({ status: "ALOCADA", turno: "NOITE", cavalo: "2064", carreta: "908", produto: "CO2", motoristaId: 3 } as never)
      const tx = criarTx()
      vi.mocked(tx.viagem.update).mockResolvedValue({ id: 1, motoristaId: 3, motoristaAcompanhanteId: null, cavalo: "2064", carreta: "908" })
      usarTransacaoCom(tx)

      await atualizarStatusViagemService(FILIAL_ID, 1, "POSTERGADA", ATOR, {
        inicioPrevisto: new Date("2026-10-02T08:00:00-03:00"),
        fimPrevisto: new Date("2026-10-02T18:00:00-03:00"),
      })

      expect(vi.mocked(tx.viagem.update).mock.calls[0][0].data.turno).toBe("MANHA")
    })

    it("sem novaData (cancelar/finalizar/iniciar), não recalcula os avisos de frota — mantém o que já estava gravado", async () => {
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
