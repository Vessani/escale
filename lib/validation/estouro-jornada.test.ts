import { describe, expect, it } from "vitest"
import { esquemaSolicitacaoMotorista } from "./estouro-jornada"

const pedido = (parcial: Record<string, unknown> = {}) => ({ viagemId: null, minutosExtras: 60, motivos: ["ABASTECER"], ...parcial })

describe("esquemaSolicitacaoMotorista", () => {
  it("aceita de 1 a 3 motivos da lista", () => {
    expect(esquemaSolicitacaoMotorista.safeParse(pedido()).success).toBe(true)
    expect(
      esquemaSolicitacaoMotorista.safeParse(pedido({ motivos: ["CLIENTE_PRIORITARIO", "TRANSITO_LENTO", "CHEGAR_HOTEL"] })).success,
    ).toBe(true)
  })

  it("recusa sem motivo, com mais de 3, repetido ou fora da lista", () => {
    expect(esquemaSolicitacaoMotorista.safeParse(pedido({ motivos: [] })).success).toBe(false)
    expect(
      esquemaSolicitacaoMotorista.safeParse(pedido({ motivos: ["CLIENTE_PRIORITARIO", "TRANSITO_LENTO", "CHEGAR_HOTEL", "ABASTECER"] }))
        .success,
    ).toBe(false)
    expect(esquemaSolicitacaoMotorista.safeParse(pedido({ motivos: ["ABASTECER", "ABASTECER"] })).success).toBe(false)
    expect(esquemaSolicitacaoMotorista.safeParse(pedido({ motivos: ["DORMIR"] })).success).toBe(false)
  })

  it("horas extras: só de 30 em 30 minutos, até 2h", () => {
    expect(esquemaSolicitacaoMotorista.safeParse(pedido({ minutosExtras: 120 })).success).toBe(true)
    expect(esquemaSolicitacaoMotorista.safeParse(pedido({ minutosExtras: 150 })).success).toBe(false)
    expect(esquemaSolicitacaoMotorista.safeParse(pedido({ minutosExtras: 45 })).success).toBe(false)
  })
})
