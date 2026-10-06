import { describe, expect, it } from "vitest"
import {
  avisoManutencaoNaViagem,
  descreverTipo,
  fimEfetivo,
  inicioEfetivo,
  manutencaoAtualOuProxima,
  manutencaoSobrepoe,
  situacaoManutencao,
  type ManutencaoBase,
} from "./manutencao-regras"

const h = (iso: string) => new Date(`${iso}-03:00`)

function manutencao(parcial: Partial<ManutencaoBase> = {}): ManutencaoBase {
  return {
    id: 1,
    veiculo: "CARRETA",
    codigo: "908",
    tipo: "PREVENTIVA",
    nivel: "B",
    responsavel: "WHITE_MARTINS",
    descricao: null,
    inicioPrevisto: h("2026-09-30T08:00:00"),
    fimPrevisto: h("2026-09-30T18:00:00"),
    inicioReal: null,
    fimReal: null,
    ...parcial,
  }
}

describe("situação e período efetivo", () => {
  it("agendada → em andamento (sem precisar registrar início) → passou da previsão → concluída", () => {
    const m = manutencao()
    expect(situacaoManutencao(m, h("2026-09-30T07:00:00"))).toBe("AGENDADA")
    expect(situacaoManutencao(m, h("2026-09-30T09:00:00"))).toBe("EM_ANDAMENTO")
    expect(situacaoManutencao(m, h("2026-09-30T19:00:00"))).toBe("ATRASADA")
    expect(situacaoManutencao({ ...m, fimReal: h("2026-09-30T17:00:00") }, h("2026-09-30T19:00:00"))).toBe("CONCLUIDA")
  })

  it("passou da previsão sem concluir: continua parado até agora", () => {
    const m = manutencao()
    const agora = h("2026-10-01T10:00:00")
    expect(fimEfetivo(m, agora)).toEqual(agora)
    expect(manutencaoSobrepoe(m, h("2026-10-01T09:00:00"), h("2026-10-01T15:00:00"), agora)).toBe(true)
  })

  it("início e fim reais valem sobre a previsão", () => {
    const m = manutencao({ inicioReal: h("2026-09-30T09:30:00"), fimReal: h("2026-09-30T14:00:00") })
    expect(inicioEfetivo(m)).toEqual(h("2026-09-30T09:30:00"))
    expect(fimEfetivo(m, h("2026-10-05T00:00:00"))).toEqual(h("2026-09-30T14:00:00"))
    expect(manutencaoSobrepoe(m, h("2026-09-30T14:00:00"), h("2026-09-30T20:00:00"), h("2026-10-05T00:00:00"))).toBe(false)
  })

  it("sem previsão de fim fica parado por tempo indeterminado", () => {
    const m = manutencao({ fimPrevisto: null })
    expect(fimEfetivo(m, h("2026-10-01T00:00:00"))).toBeNull()
    expect(manutencaoSobrepoe(m, h("2026-12-01T00:00:00"), h("2026-12-02T00:00:00"), h("2026-10-01T00:00:00"))).toBe(true)
  })

  it("descreve o tipo com o plano", () => {
    expect(descreverTipo(manutencao())).toBe("Preventiva B")
    expect(descreverTipo(manutencao({ tipo: "CORRETIVA", nivel: null }))).toBe("Corretiva")
  })
})

describe("avisoManutencaoNaViagem", () => {
  const agora = h("2026-09-29T12:00:00")

  it("avisa pela carreta ou pelo cavalo da viagem no período", () => {
    const lista = [
      manutencao(),
      manutencao({ id: 2, veiculo: "CAVALO", codigo: "75", tipo: "CORRETIVA", nivel: null, responsavel: "RITMO" }),
    ]

    expect(avisoManutencaoNaViagem(lista, "99", "908", h("2026-09-30T15:00:00"), h("2026-09-30T23:00:00"), agora)).toBe(
      "Carreta 908 em manutenção (Preventiva B, White Martins) de 30/09/2026, 08:00 a 30/09/2026, 18:00.",
    )
    expect(avisoManutencaoNaViagem(lista, "75", "111", h("2026-09-30T15:00:00"), h("2026-09-30T23:00:00"), agora)).toMatch(/^Cavalo 75/)
  })

  it("não avisa fora do período, nem pra outro veículo com o mesmo código", () => {
    const lista = [manutencao()]
    expect(avisoManutencaoNaViagem(lista, "99", "908", h("2026-09-30T18:00:00"), h("2026-09-30T23:00:00"), agora)).toBeNull()
    expect(avisoManutencaoNaViagem(lista, "908", "111", h("2026-09-30T09:00:00"), h("2026-09-30T12:00:00"), agora)).toBeNull()
  })
})

describe("manutencaoAtualOuProxima", () => {
  it("separa a que está parando agora da próxima agendada", () => {
    const agora = h("2026-09-30T10:00:00")
    const lista = [
      manutencao({ id: 1 }),
      manutencao({ id: 2, inicioPrevisto: h("2026-10-05T08:00:00"), fimPrevisto: h("2026-10-05T12:00:00") }),
      manutencao({ id: 3, fimReal: h("2026-09-29T10:00:00"), inicioPrevisto: h("2026-09-29T08:00:00") }),
    ]
    const { atual, proxima } = manutencaoAtualOuProxima(lista, "CARRETA", "908", agora)
    expect(atual?.id).toBe(1)
    expect(proxima?.id).toBe(2)
  })
})
