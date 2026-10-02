import { describe, expect, it } from "vitest"
import { relatorioViagens, STATUS_RELATORIO_VIAGENS } from "./viagens"
import type { ViagemKmCustos } from "./km-custos"

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
    produto: "OXIGENIO",
    motorista: { id: 7, nome: "LUCIANO MACHADO" },
    despesas: [
      { tipo: "PEDAGIO", valorCentavos: 1250 },
      { tipo: "PERNOITE", valorCentavos: 8000 },
    ],
    entregas: [entrega("Joinville", "SC", "", ""), entrega("Itajaí", "SC"), entrega("Blumenau", "SC")],
    ...parcial,
  }
}

describe("relatorioViagens", () => {
  it("não inclui cancelada na consulta", () => {
    expect(STATUS_RELATORIO_VIAGENS).not.toContain("CANCELADA")
    expect(STATUS_RELATORIO_VIAGENS).toContain("CRIADA")
  })

  it("uma linha por viagem com produto, cidades de cliente, km e despesas", () => {
    const { linhas } = relatorioViagens([viagem()])
    expect(linhas[0]).toMatchObject({
      numViagem: "922087",
      produto: "Oxigênio",
      regiao: ["Itajaí/SC", "Blumenau/SC"],
      kmInicial: 152300,
      kmFinal: 152780,
      kmRodado: 480,
      pedagioCentavos: 1250,
      pernoiteCentavos: 8000,
    })
  })

  it("viagem que não saiu entra sem km nem custo, e não puxa o total", () => {
    const { linhas, totais } = relatorioViagens([
      viagem({ id: 2, numViagem: "922090", status: "ALOCADA", inicioPrevisto: h("2026-10-02T06:00"), horarioRealSaida: null, finalizadoEm: null, kmInicial: null, kmFinal: null, despesas: [], produto: null }),
      viagem(),
    ])
    expect(linhas.map((l) => l.numViagem)).toEqual(["922087", "922090"])
    expect(linhas[1]).toMatchObject({ kmRodado: null, pedagioCentavos: 0, produto: null })
    expect(totais).toEqual({ viagens: 2, viagensComKm: 1, kmRodado: 480, pedagioCentavos: 1250, pernoiteCentavos: 8000 })
  })
})
