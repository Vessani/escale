import { describe, expect, it } from "vitest"
import { esquemaHotelEscalador, esquemaHotelMotorista } from "./hotel"
import { diaEmBrasilia, formatarDataPernoite, montarMensagemHotel, parseDataPernoite } from "@/lib/services/hotel-regras"

const pedido = (parcial: Record<string, unknown> = {}) => ({
  viagemId: null,
  cidade: "Curitiba",
  nomeHotel: "Hotel Ibis Curitiba Centro",
  dataPernoite: "2026-10-29",
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

  it("data do pernoite obrigatória e válida", () => {
    expect(esquemaHotelMotorista.safeParse(pedido({ dataPernoite: "" })).error?.issues[0].message).toBe("Informe a data do pernoite.")
    expect(esquemaHotelMotorista.safeParse(pedido({ dataPernoite: "2026-02-30" })).success).toBe(false)
    expect(esquemaHotelMotorista.safeParse(pedido({ dataPernoite: "29/10/2026" })).success).toBe(false)
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
      dataPernoite: parseDataPernoite("2026-10-29"),
      solicitante: "Alan",
      url: "https://x/aprovar-hotel/t",
    })
    expect(texto.split("\n")).toEqual([
      "*Solicitação de hotel (pernoite)*",
      "Motorista: JOÃO",
      "Viagem: V123",
      "Cidade: Curitiba",
      "Pernoite: 29/10/2026 (qui)",
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
      dataPernoite: parseDataPernoite("2026-10-29"),
      solicitante: null,
      url: "u",
    })
    expect(texto).not.toContain("Viagem:")
    expect(texto).not.toContain("Pedido por:")
  })
})

describe("datas do pernoite", () => {
  it("o dia é o de Brasília, não o do servidor", () => {
    expect(diaEmBrasilia(new Date("2026-10-30T02:59:00Z"))).toBe("2026-10-29")
    expect(diaEmBrasilia(new Date("2026-10-30T03:00:00Z"))).toBe("2026-10-30")
    expect(diaEmBrasilia(new Date("2026-10-29T12:00:00Z"), -1)).toBe("2026-10-28")
  })

  it("coluna date ida e volta sem mudar o dia", () => {
    expect(parseDataPernoite("2026-10-29").toISOString()).toBe("2026-10-29T00:00:00.000Z")
    expect(formatarDataPernoite(parseDataPernoite("2026-10-31"))).toBe("31/10/2026 (sáb)")
  })
})
