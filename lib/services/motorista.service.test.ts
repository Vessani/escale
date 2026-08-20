import { describe, expect, it, vi, beforeEach } from "vitest"
import type { EditarMotoristaInput, NovoMotoristaInput } from "@/lib/types/types"
import { inicioDoDia } from "@/lib/utils/date-format"

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: vi.fn(),
    motorista: { update: vi.fn() },
    registroJornada: { findFirst: vi.fn() },
  },
}))

import { prisma } from "@/lib/prisma"
import {
  criarMotoristaService,
  editarMotoristaService,
  deletarMotoristaService,
  registrarJornadaNoDia,
  registrarJornadaNoDiaService,
  buscarFimJornadaAnterior,
} from "@/lib/services/motorista.service"

const FILIAL_ID = 1

function criarTx() {
  return {
    motorista: { create: vi.fn(), update: vi.fn(), findUniqueOrThrow: vi.fn() },
    registroJornada: { upsert: vi.fn() },
  }
}

type Tx = ReturnType<typeof criarTx>

/** Faz `prisma.$transaction(callback)` invocar `callback(tx)` — o cast contorna a assinatura real (sobrecarregada) do Prisma, que não importa aqui. */
function usarTransacaoCom(tx: Tx) {
  vi.mocked(prisma.$transaction).mockImplementation(((callback: (tx: Tx) => unknown) =>
    Promise.resolve(callback(tx))) as never)
}

describe("motorista.service", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe("criarMotoristaService", () => {
    it("cria o motorista com as integrações e registra a jornada de hoje como âncora", async () => {
      const tx = criarTx()
      vi.mocked(tx.motorista.create).mockResolvedValue({ id: 42 })
      vi.mocked(tx.registroJornada.upsert).mockResolvedValue({})
      usarTransacaoCom(tx)

      const dados: NovoMotoristaInput = {
        nome: "Ana",
        cpf: "11144477735",
        seva: 1,
        diasTrabalhados: 3,
        turno: "MANHA",
        liberado: true,
        produtosAutorizados: ["CO2"],
        integracao: [{ dataValidade: "2026-12-31", cliente: "AMBEV", status: "ATIVO" }],
      }

      const resultado = await criarMotoristaService(FILIAL_ID, dados)

      expect(resultado).toEqual({ id: 42 })
      const dadosCriados = vi.mocked(tx.motorista.create).mock.calls[0][0].data
      expect(dadosCriados.nome).toBe("Ana")
      expect(dadosCriados.liberado).toBe(true)
      expect(dadosCriados.filialId).toBe(FILIAL_ID)
      expect(dadosCriados.integracao.create[0].cliente).toBe("AMBEV")

      expect(tx.registroJornada.upsert).toHaveBeenCalledTimes(1)
      const upsertArgs = vi.mocked(tx.registroJornada.upsert).mock.calls[0][0]
      expect(upsertArgs.where.motoristaId_data.motoristaId).toBe(42)
      expect(upsertArgs.create.codigo).toBe(3)

      // Registro é de hoje, então o cache diasTrabalhados também é atualizado.
      expect(tx.motorista.update).toHaveBeenCalledWith({
        where: { id: 42 },
        data: { diasTrabalhados: 3 },
      })
    })

    it("cadastra em treinamento (liberado: false)", async () => {
      const tx = criarTx()
      vi.mocked(tx.motorista.create).mockResolvedValue({ id: 43 })
      vi.mocked(tx.registroJornada.upsert).mockResolvedValue({})
      usarTransacaoCom(tx)

      await criarMotoristaService(FILIAL_ID, {
        nome: "Bruno",
        cpf: "52998224725",
        seva: 2,
        diasTrabalhados: 1,
        turno: "MANHA",
        liberado: false,
        produtosAutorizados: [],
        integracao: [],
      })

      const dadosCriados = vi.mocked(tx.motorista.create).mock.calls[0][0].data
      expect(dadosCriados.liberado).toBe(false)
    })
  })

  describe("editarMotoristaService", () => {
    it("separa integrações existentes (update) de novas (create) e mantém só as informadas", async () => {
      vi.mocked(prisma.motorista.update).mockResolvedValue({ id: 5 } as never)

      const tx = criarTx()
      vi.mocked(tx.motorista.findUniqueOrThrow).mockResolvedValue({ id: 5 })
      vi.mocked(tx.registroJornada.upsert).mockResolvedValue({})
      usarTransacaoCom(tx)

      const dados: EditarMotoristaInput = {
        nome: "Ana",
        cpf: "11144477735",
        seva: 1,
        diasTrabalhados: 4,
        turno: "NOITE",
        liberado: true,
        produtosAutorizados: ["CO2", "NITROGENIO"],
        integracao: [
          { id: 10, dataValidade: "2026-12-31", cliente: "AMBEV", status: "ATIVO" },
          { dataValidade: "2027-01-01", cliente: "WEG", status: "ATIVO" },
        ],
      }

      await editarMotoristaService(FILIAL_ID, 5, dados)

      const chamada = vi.mocked(prisma.motorista.update).mock.calls[0][0] as {
        where: { id: number; filialId: number }
        data: { liberado: boolean; integracao: { deleteMany: { id: { notIn: number[] } }; update: unknown[]; create: unknown[] } }
      }
      expect(chamada.where).toEqual({ id: 5, filialId: FILIAL_ID })
      expect(chamada.data.liberado).toBe(true)
      expect(chamada.data.integracao.deleteMany.id.notIn).toEqual([10])
      expect(chamada.data.integracao.update).toHaveLength(1)
      expect(chamada.data.integracao.create).toHaveLength(1)

      // Também grava "diasTrabalhados" no histórico de hoje.
      expect(prisma.$transaction).toHaveBeenCalledTimes(1)
    })
  })

  describe("deletarMotoristaService", () => {
    it("marca deletadoEm em vez de apagar o registro", async () => {
      vi.mocked(prisma.motorista.update).mockResolvedValue({ id: 9 } as never)

      await deletarMotoristaService(FILIAL_ID, 9)

      const chamada = vi.mocked(prisma.motorista.update).mock.calls[0][0] as { where: { id: number; filialId: number }; data: { deletadoEm: Date } }
      expect(chamada.where).toEqual({ id: 9, filialId: FILIAL_ID })
      expect(chamada.data.deletadoEm).toBeInstanceOf(Date)
    })
  })

  describe("registrarJornadaNoDia", () => {
    it("atualiza o cache diasTrabalhados quando o dia registrado é hoje", async () => {
      const tx = criarTx()
      vi.mocked(tx.registroJornada.upsert).mockResolvedValue({ codigo: 5 })

      await registrarJornadaNoDia(tx as never, 1, new Date(), 5)

      expect(tx.motorista.update).toHaveBeenCalledWith({ where: { id: 1 }, data: { diasTrabalhados: 5 } })
    })

    it("não toca no cache diasTrabalhados quando o dia registrado não é hoje", async () => {
      const tx = criarTx()
      vi.mocked(tx.registroJornada.upsert).mockResolvedValue({ codigo: 5 })
      const ontem = new Date(inicioDoDia(new Date()).getTime() - 24 * 60 * 60 * 1000)

      await registrarJornadaNoDia(tx as never, 1, ontem, 5)

      expect(tx.motorista.update).not.toHaveBeenCalled()
    })

    it("grava inicioJornada/fimJornada quando horas é informado (import do relatório)", async () => {
      const tx = criarTx()
      vi.mocked(tx.registroJornada.upsert).mockResolvedValue({ codigo: 5 })
      const inicio = new Date("2026-07-10T08:00:00")
      const fim = new Date("2026-07-10T18:00:00")

      await registrarJornadaNoDia(tx as never, 1, new Date("2026-07-10"), 5, { inicioJornada: inicio, fimJornada: fim })

      const chamada = vi.mocked(tx.registroJornada.upsert).mock.calls[0][0] as {
        create: { inicioJornada: Date; fimJornada: Date }
        update: { inicioJornada?: Date; fimJornada?: Date }
      }
      expect(chamada.create.inicioJornada).toEqual(inicio)
      expect(chamada.update.inicioJornada).toEqual(inicio)
      expect(chamada.update.fimJornada).toEqual(fim)
    })

    it("não manda inicioJornada/fimJornada no update quando horas não é informado — não apaga um horário real já gravado nesse dia (edição manual do calendário)", async () => {
      const tx = criarTx()
      vi.mocked(tx.registroJornada.upsert).mockResolvedValue({ codigo: 3 })

      await registrarJornadaNoDia(tx as never, 1, new Date("2026-07-10"), 3)

      const chamada = vi.mocked(tx.registroJornada.upsert).mock.calls[0][0] as { update: object }
      expect(chamada.update).not.toHaveProperty("inicioJornada")
      expect(chamada.update).not.toHaveProperty("fimJornada")
    })
  })

  describe("registrarJornadaNoDiaService", () => {
    it("confirma que o motorista pertence à filial, abre uma transação e delega para registrarJornadaNoDia", async () => {
      const tx = criarTx()
      vi.mocked(tx.motorista.findUniqueOrThrow).mockResolvedValue({ id: 3 })
      vi.mocked(tx.registroJornada.upsert).mockResolvedValue({ codigo: 2 })
      usarTransacaoCom(tx)

      await registrarJornadaNoDiaService(FILIAL_ID, 3, new Date(), 2)

      expect(tx.motorista.findUniqueOrThrow).toHaveBeenCalledWith({
        where: { id: 3, filialId: FILIAL_ID },
        select: { id: true },
      })
      expect(prisma.$transaction).toHaveBeenCalledTimes(1)
      expect(tx.registroJornada.upsert).toHaveBeenCalledTimes(1)
    })

    it("propaga o erro (registro não encontrado) sem chamar registrarJornadaNoDia quando o motorista não é da filial", async () => {
      const tx = criarTx()
      vi.mocked(tx.motorista.findUniqueOrThrow).mockRejectedValue(new Error("Registro não encontrado."))
      usarTransacaoCom(tx)

      await expect(registrarJornadaNoDiaService(FILIAL_ID, 3, new Date(), 2)).rejects.toThrow()
      expect(tx.registroJornada.upsert).not.toHaveBeenCalled()
    })
  })

  describe("buscarFimJornadaAnterior", () => {
    it("consulta o RegistroJornada filtrando por motorista, filial, fimJornada não nulo e anterior ao início da viagem, pegando o mais recente", async () => {
      const fimJornada = new Date("2026-07-07T20:00:00")
      vi.mocked(prisma.registroJornada.findFirst).mockResolvedValue({ fimJornada } as never)
      const inicioViagem = new Date("2026-07-08T09:00:00")

      const resultado = await buscarFimJornadaAnterior(FILIAL_ID, 5, inicioViagem)

      expect(resultado).toEqual(fimJornada)
      expect(prisma.registroJornada.findFirst).toHaveBeenCalledWith({
        where: {
          motoristaId: 5,
          motorista: { filialId: FILIAL_ID },
          fimJornada: { not: null, lt: inicioViagem },
        },
        orderBy: { fimJornada: "desc" },
        select: { fimJornada: true },
      })
    })

    it("retorna null quando não há nenhum registro anterior (motorista sem jornada real importada, ou nenhuma antes da viagem)", async () => {
      vi.mocked(prisma.registroJornada.findFirst).mockResolvedValue(null)

      const resultado = await buscarFimJornadaAnterior(FILIAL_ID, 5, new Date("2026-07-08T09:00:00"))

      expect(resultado).toBeNull()
    })

    it("a própria query já filtra fimJornada < início da viagem e ignora nulos — não depende do chamador saber disso", async () => {
      // Cobre a causa raiz do bug relatado: uma jornada importada posterior ao
      // início da viagem (ex: viagem às 09:00, jornada 08:15–15:38 já
      // importada) nunca pode "vencer" aqui — o filtro `lt: inicioViagem` do
      // Prisma já a exclui antes mesmo de chegar no `orderBy`.
      vi.mocked(prisma.registroJornada.findFirst).mockResolvedValue(null)
      const inicioViagem = new Date("2026-07-08T09:00:00")

      await buscarFimJornadaAnterior(FILIAL_ID, 5, inicioViagem)

      const chamada = vi.mocked(prisma.registroJornada.findFirst).mock.calls[0][0] as {
        where: { fimJornada: { not: null; lt: Date } }
      }
      expect(chamada.where.fimJornada.lt).toEqual(inicioViagem)
      expect(chamada.where.fimJornada.not).toBeNull()
    })
  })
})
