import { describe, expect, it } from "vitest"
import { descreverAutorizacoes, partesDaAutorizacao } from "./formato"
import type { AutorizacaoEstouro } from "@/lib/services/relatorios/jornada-analise"

const autorizacao = (extra: Partial<AutorizacaoEstouro> = {}): AutorizacaoEstouro => ({
  id: 1,
  motoristaId: 10,
  criadoEm: new Date("2026-10-27T16:00:00Z"),
  // 17:05 UTC = 14:05 em Brasília
  decididoEm: new Date("2026-10-27T17:05:00Z"),
  decididoPorNome: "Roberto",
  minutosExtras: 90,
  motivos: ["TRANSITO_LENTO"],
  pedidoPeloMotorista: true,
  ...extra,
})

describe("partesDaAutorizacao", () => {
  it("separa quem, quando, quanto, por quê e quem pediu", () => {
    expect(partesDaAutorizacao(autorizacao())).toEqual({
      quem: "Roberto",
      quando: "27/10 14:05",
      extras: "+1h30",
      motivos: "Trânsito lento",
      pedidoPor: "pelo motorista",
    })
  })

  it("sem decisão gravada: quem vira traço e quando fica null", () => {
    const partes = partesDaAutorizacao(autorizacao({ decididoPorNome: null, decididoEm: null, pedidoPeloMotorista: false }))
    expect(partes.quem).toBe("—")
    expect(partes.quando).toBeNull()
    expect(partes.pedidoPor).toBe("pelo escalador")
  })
})

describe("descreverAutorizacoes", () => {
  it("sem pedido aprovado", () => {
    expect(descreverAutorizacoes([])).toBe("Sem autorização")
  })

  it("monta a linha do Excel e separa vários pedidos com |", () => {
    const texto = descreverAutorizacoes([autorizacao(), autorizacao({ id: 2, decididoEm: null, pedidoPeloMotorista: false })])
    expect(texto).toBe(
      "Roberto em 27/10 14:05 · +1h30 (Trânsito lento) · pedido pelo motorista | Roberto · +1h30 (Trânsito lento) · pedido pelo escalador",
    )
  })
})
