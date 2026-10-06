import { describe, expect, it } from "vitest"
import type { MotoristaComAgenda } from "./alocacao.service"
import { montarMotoristaCompativel } from "./motorista-compativel.service"

const h = (iso: string) => new Date(`${iso}-03:00`)
const hoje = h("2026-10-06T00:00:00")

function motorista(parcial: Partial<MotoristaComAgenda> = {}): MotoristaComAgenda {
  return {
    id: 7,
    nome: "João",
    turno: "MANHA",
    diasTrabalhados: 2,
    tipo: "MOTORISTA",
    integracao: [],
    registrosJornada: [],
    jornadaRelatorioInicio: h("2026-10-05T06:30:00"),
    jornadaRelatorioFim: null,
    produtosAutorizados: ["OXIGENIO"],
    viagens: [],
    ...parcial,
  }
}

describe("montarMotoristaCompativel", () => {
  it("descansado: dias disponíveis pelo código projetado, horário habitual em Brasília, sem aviso", () => {
    const item = montarMotoristaCompativel(motorista(), { inicioPrevisto: h("2026-10-06T07:00:00") }, hoje)
    expect(item).toMatchObject({ id: 7, nome: "João", horarioHabitual: "06:30", proximoInicioDisponivel: null, liberadoEm: null })
    expect(item.diasDisponiveis).toBeGreaterThan(0)
    expect(item.avisoDescanso).toBeNull()
  })

  it("com viagem terminando perto do início: diz quando fica livre e gera o aviso de descanso", () => {
    const comViagem = motorista({
      viagens: [{ id: 99, inicioPrevisto: h("2026-10-05T20:00:00"), fimPrevisto: h("2026-10-06T02:00:00"), status: "ALOCADA" }],
    })
    const item = montarMotoristaCompativel(comViagem, { id: 1, inicioPrevisto: h("2026-10-06T07:00:00") }, hoje)
    expect(item.liberadoEm).not.toBeNull()
    expect(new Date(item.liberadoEm!).getTime()).toBeGreaterThan(h("2026-10-06T07:00:00").getTime())
    expect(item.proximoInicioDisponivel).toMatch(/^\d{2}:\d{2}$/)
    expect(item.avisoDescanso).not.toBeNull()
  })
})
