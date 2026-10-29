import { describe, expect, it } from "vitest"
import { esquemaHotelEscalador, esquemaHotelMotorista } from "./hotel"
import { montarMensagemHotel } from "@/lib/services/hotel-regras"

const pedido = (parcial: Record<string, unknown> = {}) => ({
  viagemId: null,
  cidade: "Curitiba",
  nomeHotel: "Hotel Ibis Curitiba Centro",
  ...parcial,
})

describe("esquemaHotelMotorista", () => {
  it("aceita cidade e hotel, tirando os espaços das pontas", () => {
    expect(esquemaHotelMotorista.parse(pedido({ cidade: "  Lages  ", nomeHotel: " Hotel Serrano " }))).toMatchObject({
      cidade: "Lages",
      nomeHotel: "Hotel Serrano",
    })
  })

  it("cidade e hotel obrigatórios", () => {
    const semCidade = esquemaHotelMotorista.safeParse(pedido({ cidade: "  " }))
    expect(semCidade.error?.issues[0].message).toBe("Informe a cidade do pernoite.")
    const semHotel = esquemaHotelMotorista.safeParse(pedido({ nomeHotel: "" }))
    expect(semHotel.error?.issues[0].message).toBe("Informe o nome do hotel.")
  })

  it("respeita o tamanho das colunas", () => {
    expect(esquemaHotelMotorista.safeParse(pedido({ cidade: "x".repeat(101) })).success).toBe(false)
    expect(esquemaHotelMotorista.safeParse(pedido({ nomeHotel: "x".repeat(151) })).success).toBe(false)
    expect(esquemaHotelMotorista.safeParse(pedido({ cidade: "x".repeat(100), nomeHotel: "x".repeat(150) })).success).toBe(true)
  })
})

describe("esquemaHotelEscalador", () => {
  it("exige o motorista", () => {
    expect(esquemaHotelEscalador.safeParse(pedido()).success).toBe(false)
    expect(esquemaHotelEscalador.safeParse(pedido({ motoristaId: 7 })).success).toBe(true)
  })
})

describe("montarMensagemHotel", () => {
  it("leva motorista, viagem, cidade, hotel, quem pediu e o link", () => {
    const texto = montarMensagemHotel({
      motorista: "JOÃO",
      numViagem: "V123",
      cidade: "Curitiba",
      nomeHotel: "Hotel Ibis",
      solicitante: "Alan",
      url: "https://x/aprovar-hotel/t",
    })
    expect(texto.split("\n")).toEqual([
      "*Solicitação de hotel (pernoite)*",
      "Motorista: JOÃO",
      "Viagem: V123",
      "Cidade: Curitiba",
      "Hotel: Hotel Ibis",
      "Pedido por: Alan",
      "",
      "Gestor, aprove ou recuse: https://x/aprovar-hotel/t",
    ])
  })

  it("sem viagem nem solicitante, não põe as linhas", () => {
    const texto = montarMensagemHotel({
      motorista: "JOÃO",
      numViagem: null,
      cidade: "Lages",
      nomeHotel: "Serrano",
      solicitante: null,
      url: "u",
    })
    expect(texto).not.toContain("Viagem:")
    expect(texto).not.toContain("Pedido por:")
  })
})
