import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/prisma", () => ({ prisma: { $transaction: vi.fn(), chegadaEntrega: { findFirst: vi.fn() } } }))
vi.mock("@/lib/services/auditoria.service", () => ({ registrarAuditoria: vi.fn() }))

import { prisma } from "@/lib/prisma"
import { registrarAuditoria } from "@/lib/services/auditoria.service"
import { apagarChegadaPeloEscalador } from "./correcao-registro.service"

const ator = { usuarioId: "u1", usuarioNome: "Alan" }
const tx = { $queryRaw: vi.fn(), chegadaEntrega: { delete: vi.fn() } }

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(prisma.$transaction).mockImplementation(((cb: (t: unknown) => unknown) => Promise.resolve(cb(tx))) as never)
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
    expect(vi.mocked(registrarAuditoria).mock.calls[0][1]).toMatchObject({
      entidade: "ChegadaEntrega", entidadeId: 7, acao: "EXCLUSAO", antes: { id: 7, km: 152410, _contexto: "Chegada em HOSPITAL (viagem 922087)" },
    })
  })

  it("chegada de outra filial (ou inexistente): não encontrada, nada apagado", async () => {
    vi.mocked(prisma.chegadaEntrega.findFirst).mockResolvedValue(null)
    await expect(apagarChegadaPeloEscalador(3, 7, ator)).rejects.toThrow("não encontrada")
    expect(tx.chegadaEntrega.delete).not.toHaveBeenCalled()
  })
})
