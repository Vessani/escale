import { describe, expect, it } from "vitest"
import { diffAuditoria, formatarCampoAlterado } from "@/lib/utils/diff-auditoria"

describe("diffAuditoria", () => {
  it("reporta só os campos que mudaram", () => {
    const alteracoes = diffAuditoria({ status: "ALOCADA", motoristaId: 5 }, { status: "CANCELADA", motoristaId: 5 })

    expect(alteracoes).toEqual([{ campo: "status", valorAntigo: "ALOCADA", valorNovo: "CANCELADA" }])
  })

  it("ignora id/criadoEm/atualizadoEm mesmo quando diferem", () => {
    const alteracoes = diffAuditoria({ id: 1, criadoEm: "a", atualizadoEm: "a" }, { id: 1, criadoEm: "b", atualizadoEm: "b" })

    expect(alteracoes).toEqual([])
  })

  it("trata criação (antes null) — tudo em depois conta como alterado", () => {
    const alteracoes = diffAuditoria(null, { nome: "Ana" })

    expect(alteracoes).toEqual([{ campo: "nome", valorAntigo: undefined, valorNovo: "Ana" }])
  })

  it("compara objetos/arrays aninhados como um valor só (JSON.stringify)", () => {
    const alteracoes = diffAuditoria({ entregas: [{ cliente: "A" }] }, { entregas: [{ cliente: "B" }] })

    expect(alteracoes).toHaveLength(1)
    expect(alteracoes[0].campo).toBe("entregas")
  })

  it("não reporta nada quando os dois lados são idênticos", () => {
    expect(diffAuditoria({ nome: "Ana" }, { nome: "Ana" })).toEqual([])
  })
})

describe("formatarCampoAlterado", () => {
  it("formata como 'campo: antigo → novo'", () => {
    expect(formatarCampoAlterado({ campo: "status", valorAntigo: "ALOCADA", valorNovo: "CANCELADA" })).toBe(
      "status: ALOCADA → CANCELADA",
    )
  })

  it("mostra travessão pra valores nulos/indefinidos", () => {
    expect(formatarCampoAlterado({ campo: "motoristaId", valorAntigo: null, valorNovo: 5 })).toBe("motoristaId: — → 5")
  })
})
