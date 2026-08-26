import { describe, expect, it, vi } from "vitest"
import { registrarAuditoria, atorDaSessao } from "@/lib/services/auditoria.service"

function criarTx() {
  return {
    registroAuditoria: { create: vi.fn() },
  }
}

describe("registrarAuditoria", () => {
  it("grava entidade/entidadeId/acao e serializa antes/depois (Date/Decimal viram valor plano)", async () => {
    const tx = criarTx()
    const antes = { status: "ALOCADA", inicioPrevisto: new Date("2026-08-20T08:00:00.000Z") }
    const depois = { status: "CANCELADA", inicioPrevisto: new Date("2026-08-20T08:00:00.000Z") }

    await registrarAuditoria(tx as never, {
      entidade: "Viagem",
      entidadeId: 42,
      acao: "ATUALIZACAO",
      antes,
      depois,
      ator: { usuarioId: "u1", usuarioNome: "João" },
      filialId: 1,
    })

    expect(tx.registroAuditoria.create).toHaveBeenCalledWith({
      data: {
        entidade: "Viagem",
        entidadeId: "42",
        acao: "ATUALIZACAO",
        antes: { status: "ALOCADA", inicioPrevisto: "2026-08-20T08:00:00.000Z" },
        depois: { status: "CANCELADA", inicioPrevisto: "2026-08-20T08:00:00.000Z" },
        usuarioId: "u1",
        usuarioNome: "João",
        filialId: 1,
      },
    })
  })

  it("entidadeId sempre vira string, mesmo vindo de um id numérico", async () => {
    const tx = criarTx()
    await registrarAuditoria(tx as never, {
      entidade: "Motorista",
      entidadeId: 7,
      acao: "CRIACAO",
      depois: { nome: "Ana" },
      ator: null,
      filialId: 1,
    })

    const chamada = tx.registroAuditoria.create.mock.calls[0][0] as { data: { entidadeId: string } }
    expect(chamada.data.entidadeId).toBe("7")
  })

  it("ator nulo grava usuarioId/usuarioNome como null (mudança sem humano por trás)", async () => {
    const tx = criarTx()
    await registrarAuditoria(tx as never, {
      entidade: "Frota",
      entidadeId: "1",
      acao: "ATUALIZACAO",
      ator: null,
      filialId: 1,
    })

    const chamada = tx.registroAuditoria.create.mock.calls[0][0] as { data: { usuarioId: string | null; usuarioNome: string | null } }
    expect(chamada.data.usuarioId).toBeNull()
    expect(chamada.data.usuarioNome).toBeNull()
  })

  it("antes/depois omitidos (undefined) não viram null forçado — fica undefined pro Prisma", async () => {
    const tx = criarTx()
    await registrarAuditoria(tx as never, {
      entidade: "Usuario",
      entidadeId: "u1",
      acao: "ATUALIZACAO",
      ator: { usuarioId: "u1", usuarioNome: "João" },
      filialId: null,
    })

    const chamada = tx.registroAuditoria.create.mock.calls[0][0] as { data: { antes: unknown; depois: unknown } }
    expect(chamada.data.antes).toBeUndefined()
    expect(chamada.data.depois).toBeUndefined()
  })
})

describe("atorDaSessao", () => {
  it("extrai usuarioId/usuarioNome da sessão", () => {
    expect(atorDaSessao({ user: { id: "u1", name: "João" } })).toEqual({ usuarioId: "u1", usuarioNome: "João" })
  })

  it("nome ausente/null vira null (não undefined)", () => {
    expect(atorDaSessao({ user: { id: "u1" } })).toEqual({ usuarioId: "u1", usuarioNome: null })
    expect(atorDaSessao({ user: { id: "u1", name: null } })).toEqual({ usuarioId: "u1", usuarioNome: null })
  })
})
