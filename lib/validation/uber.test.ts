import { describe, expect, it } from "vitest"
import { esquemaUberEscalador, esquemaUberMotorista } from "./uber"
import { MOTIVOS_UBER, formatarMotivoUber } from "@/lib/services/uber-regras"

const pedido = (parcial: Record<string, unknown> = {}) => ({
  viagemId: null,
  origem: "Posto Graal",
  destino: "Hotel Ibis",
  motivo: "PERNOITE",
  ...parcial,
})

describe("motivos do Uber", () => {
  it("são os quatro combinados, na ordem da tela", () => {
    expect(MOTIVOS_UBER.map((m) => m.rotulo)).toEqual(["Pernoite", "Manutenção", "Buscar frota", "Render motorista"])
    expect(formatarMotivoUber("RENDER_MOTORISTA")).toBe("Render motorista")
  })
})

describe("esquemaUberMotorista", () => {
  it("aceita origem, destino e um motivo da lista", () => {
    for (const motivo of ["PERNOITE", "MANUTENCAO", "BUSCAR_FROTA", "RENDER_MOTORISTA"]) {
      expect(esquemaUberMotorista.safeParse(pedido({ motivo })).success).toBe(true)
    }
  })

  it("recusa motivo fora da lista, sem motivo, ou vários", () => {
    expect(esquemaUberMotorista.safeParse(pedido({ motivo: "PASSEIO" })).success).toBe(false)
    expect(esquemaUberMotorista.safeParse(pedido({ motivo: undefined })).success).toBe(false)
    expect(esquemaUberMotorista.safeParse(pedido({ motivo: ["PERNOITE", "MANUTENCAO"] })).success).toBe(false)
  })

  it("origem e destino: obrigatórios, até 150 caracteres e diferentes entre si", () => {
    expect(esquemaUberMotorista.safeParse(pedido({ origem: "  " })).success).toBe(false)
    expect(esquemaUberMotorista.safeParse(pedido({ destino: "x".repeat(151) })).success).toBe(false)
    const iguais = esquemaUberMotorista.safeParse(pedido({ origem: "Base Joinville", destino: " base joinville " }))
    expect(iguais.success).toBe(false)
    expect(iguais.error?.issues[0].message).toBe("Origem e destino estão iguais.")
  })

  it("tira os espaços das pontas", () => {
    expect(esquemaUberMotorista.parse(pedido({ origem: "  Posto Graal  " })).origem).toBe("Posto Graal")
  })
})

describe("esquemaUberEscalador", () => {
  it("exige o motorista", () => {
    expect(esquemaUberEscalador.safeParse(pedido()).success).toBe(false)
    expect(esquemaUberEscalador.safeParse(pedido({ motoristaId: 7 })).success).toBe(true)
  })
})
