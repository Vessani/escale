import { describe, expect, it } from "vitest"
import { linhaKmCustos, regiaoDaViagem, relatorioKmCustos, type ViagemKmCustos } from "./km-custos"

const h = (iso: string) => new Date(`${iso}:00-03:00`)
const entrega = (cidade: string, uf: string, sapcode = "1001", codewhite = "W77") => ({ cidade, uf, sapcode, codewhite })

function viagem(parcial: Partial<ViagemKmCustos> = {}): ViagemKmCustos {
  return {
    id: 1,
    numViagem: "922087",
    status: "FINALIZADA",
    inicioPrevisto: h("2026-10-01T07:00"),
    horarioRealSaida: h("2026-10-01T07:20"),
    finalizadoEm: h("2026-10-01T18:00"),
    kmInicial: 152300,
    kmFinal: 152780,
    cavalo: "2025",
    carreta: "795",
    motorista: { id: 7, nome: "LUCIANO MACHADO" },
    despesas: [
      { tipo: "PEDAGIO", valorCentavos: 1250 },
      { tipo: "PEDAGIO", valorCentavos: 890 },
      { tipo: "PERNOITE", valorCentavos: 8000 },
    ],
    entregas: [entrega("Joinville", "SC")],
    ...parcial,
  }
}

describe("regiaoDaViagem", () => {
  it("só cidades de cliente com SAP code E número white; sem repetir; na ordem da rota", () => {
    expect(
      regiaoDaViagem([
        entrega("Joinville", "SC", "", ""), // base/coleta: sem códigos
        entrega("Itajaí", "sc"),
        entrega("Blumenau", "SC", "2002", ""), // sem white
        entrega("Brusque", "SC", "", "W1"), // sem SAP
        entrega("Itajaí", "SC"),
        entrega("Curitiba", "PR", "000", "W2"), // SAP "000" não vale
        entrega(" CURITIBA ", "PR", "3003", "W3"), // mesma cidade, escrita diferente
      ]),
    ).toEqual(["Itajaí/SC", "Curitiba/PR"])
  })
})

describe("linhaKmCustos", () => {
  it("km rodado, pedágio e pernoite somados, custo total, início pela saída real e fim pela finalização", () => {
    const linha = linhaKmCustos(viagem())
    expect(linha).toMatchObject({
      kmRodado: 480,
      pedagioCentavos: 2140,
      pernoiteCentavos: 8000,
      custoCentavos: 10140,
      inicio: h("2026-10-01T07:20"),
      inicioEhPrevisto: false,
      fim: h("2026-10-01T18:00"),
      regiao: ["Joinville/SC"],
    })
  })

  it("em andamento: sem km final não tem km rodado nem fim; sem saída real usa o previsto", () => {
    const linha = linhaKmCustos(viagem({ status: "INICIADA", kmFinal: null, finalizadoEm: null, horarioRealSaida: null, despesas: [] }))
    expect(linha).toMatchObject({ kmRodado: null, fim: null, inicio: h("2026-10-01T07:00"), inicioEhPrevisto: true, custoCentavos: 0 })
  })
})

describe("relatorioKmCustos", () => {
  it("totais do período; custo por km só com as viagens que têm km dos dois lados", () => {
    const { linhas, totais } = relatorioKmCustos([
      viagem({ id: 2, inicioPrevisto: h("2026-10-02T07:00"), horarioRealSaida: null }),
      viagem({ id: 1 }),
      viagem({ id: 3, status: "INICIADA", kmFinal: null, despesas: [{ tipo: "PEDAGIO", valorCentavos: 500 }] }),
    ])
    expect(linhas.map((linha) => linha.id)).toEqual([1, 3, 2])
    expect(totais).toEqual({
      viagens: 3,
      semRegistro: 0,
      viagensComKm: 2,
      kmRodado: 960,
      pedagioCentavos: 2140 * 2 + 500,
      pernoiteCentavos: 16000,
      custoCentavos: 10140 * 2 + 500,
      custoMedioPorViagemCentavos: Math.round((10140 * 2 + 500) / 3),
      custoPorKmCentavos: Math.round((10140 * 2) / 960),
    })
  })

  it("sem km nenhum: custo por km fica vazio", () => {
    expect(relatorioKmCustos([viagem({ kmFinal: null })]).totais.custoPorKmCentavos).toBeNull()
  })

  it("viagem sem nenhum registro do motorista fica fora por padrão (e fora da média); 'todas' mostra", () => {
    const viagens = [viagem({ id: 1 }), viagem({ id: 2, kmInicial: null, kmFinal: null, despesas: [] })]
    const padrao = relatorioKmCustos(viagens)
    expect(padrao.linhas.map((linha) => linha.id)).toEqual([1])
    expect(padrao.totais).toMatchObject({ viagens: 1, semRegistro: 1, custoMedioPorViagemCentavos: 10140 })

    const todas = relatorioKmCustos(viagens, "todas")
    expect(todas.linhas.map((linha) => linha.id)).toEqual([1, 2])
    expect(todas.totais).toMatchObject({ viagens: 2, semRegistro: 1, custoMedioPorViagemCentavos: 10140 })
  })
})
