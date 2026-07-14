import { describe, expect, it, vi, beforeEach } from "vitest"
import type { EditarMotoristaInput, NovoMotoristaInput } from "@/lib/types/types"
import { inicioDoDia } from "@/lib/utils/date-format"

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: vi.fn(),
    motorista: { update: vi.fn() },
  },
}))

import { prisma } from "@/lib/prisma"
import {
  criarMotoristaService,
  editarMotoristaService,
  deletarMotoristaService,
  registrarJornadaNoDia,
  registrarJornadaNoDiaService,
} from "@/lib/services/motorista.service"

function criarTx() {
  return {
    motorista: { create: vi.fn(), update: vi.fn() },
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
        seva: 1,
        diasTrabalhados: 3,
        turno: "MANHA",
        integracao: [{ dataValidade: "2026-12-31", cliente: "AMBEV", status: "ATIVO" }],
      }

      const resultado = await criarMotoristaService(dados)

      expect(resultado).toEqual({ id: 42 })
      const dadosCriados = vi.mocked(tx.motorista.create).mock.calls[0][0].data
      expect(dadosCriados.nome).toBe("Ana")
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
  })

  describe("editarMotoristaService", () => {
    it("separa integrações existentes (update) de novas (create) e mantém só as informadas", async () => {
      vi.mocked(prisma.motorista.update).mockResolvedValue({ id: 5 } as never)

      const tx = criarTx()
      vi.mocked(tx.registroJornada.upsert).mockResolvedValue({})
      usarTransacaoCom(tx)

      const dados: EditarMotoristaInput = {
        nome: "Ana",
        seva: 1,
        diasTrabalhados: 4,
        turno: "NOITE",
        integracao: [
          { id: 10, dataValidade: "2026-12-31", cliente: "AMBEV", status: "ATIVO" },
          { dataValidade: "2027-01-01", cliente: "WEG", status: "ATIVO" },
        ],
      }

      await editarMotoristaService(5, dados)

      const chamada = vi.mocked(prisma.motorista.update).mock.calls[0][0] as {
        data: { integracao: { deleteMany: { id: { notIn: number[] } }; update: unknown[]; create: unknown[] } }
      }
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

      await deletarMotoristaService(9)

      const chamada = vi.mocked(prisma.motorista.update).mock.calls[0][0] as { data: { deletadoEm: Date } }
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
  })

  describe("registrarJornadaNoDiaService", () => {
    it("abre uma transação e delega para registrarJornadaNoDia", async () => {
      const tx = criarTx()
      vi.mocked(tx.registroJornada.upsert).mockResolvedValue({ codigo: 2 })
      usarTransacaoCom(tx)

      await registrarJornadaNoDiaService(3, new Date(), 2)

      expect(prisma.$transaction).toHaveBeenCalledTimes(1)
      expect(tx.registroJornada.upsert).toHaveBeenCalledTimes(1)
    })
  })
})
