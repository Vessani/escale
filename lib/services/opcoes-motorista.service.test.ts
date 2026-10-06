import { describe, expect, it } from "vitest"
import { montarOpcoesMotoristaPorViagem } from "./opcoes-motorista.service"

const HOJE = new Date("2026-09-30T00:00:00-03:00")

function motorista(parcial: Record<string, unknown> = {}) {
  return {
    id: 1,
    nome: "ANA",
    turno: "MANHA" as const,
    diasTrabalhados: 1,
    tipo: "MOTORISTA" as const,
    produtosAutorizados: ["CO2" as const],
    jornadaRelatorioInicio: null,
    jornadaRelatorioFim: null,
    integracao: [],
    registrosJornada: [],
    viagens: [],
    ...parcial,
  }
}

const VIAGEM = {
  id: 10,
  turno: "MANHA" as const,
  diasViagem: 1,
  inicioPrevisto: new Date("2026-09-30T08:00:00-03:00"),
  fimPrevisto: new Date("2026-09-30T18:00:00-03:00"),
  integracaoExigida: null,
  produto: "CO2" as const,
}

describe("montarOpcoesMotoristaPorViagem", () => {
  it("devolve só id, nome, tipo e situação — nada de agenda ou histórico pro navegador", () => {
    const opcoes = montarOpcoesMotoristaPorViagem([motorista()], [VIAGEM], HOJE).get(10)

    expect(opcoes).toEqual([{ id: 1, nome: "ANA", tipo: "MOTORISTA", situacao: "OK", motivo: "6 dias disponíveis" }])
  })

  it("ignora a própria viagem na agenda — quem já está nela não aparece ocupado", () => {
    const naPropriaViagem = motorista({
      viagens: [{ id: 10, status: "ALOCADA", inicioPrevisto: VIAGEM.inicioPrevisto, fimPrevisto: VIAGEM.fimPrevisto }],
    })
    const emOutraViagem = motorista({
      id: 2,
      nome: "BRUNO",
      viagens: [{ id: 99, status: "ALOCADA", inicioPrevisto: VIAGEM.inicioPrevisto, fimPrevisto: VIAGEM.fimPrevisto }],
    })

    const opcoes = montarOpcoesMotoristaPorViagem([naPropriaViagem, emOutraViagem], [VIAGEM], HOJE).get(10)

    expect(opcoes?.map((opcao) => opcao.situacao)).toEqual(["OK", "SEM_DESCANSO"])
    expect(opcoes?.[1].motivo).toBe("Em viagem até 30/09 18:00")
  })

  it("laranja diz até quando vai o descanso (11h, ou 35h depois do 6º dia)", () => {
    const ontem = motorista({
      viagens: [{ id: 98, status: "FINALIZADA", inicioPrevisto: new Date("2026-09-29T14:00:00-03:00"), fimPrevisto: new Date("2026-09-30T00:00:00-03:00") }],
    })
    const opcoes = montarOpcoesMotoristaPorViagem([ontem], [VIAGEM], HOJE).get(10)
    expect(opcoes?.[0]).toMatchObject({ situacao: "SEM_DESCANSO", motivo: "Descanso até 30/09 11:00" })
  })

  it("marca fora da regra quem é de outro turno", () => {
    const opcoes = montarOpcoesMotoristaPorViagem([motorista({ turno: "NOITE" })], [VIAGEM], HOJE).get(10)

    expect(opcoes?.[0].situacao).toBe("FORA_DA_REGRA")
    expect(opcoes?.[0].motivo).toBe("Turno Noite")
  })
})
