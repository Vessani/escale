import { describe, expect, it } from "vitest"
import { HORAS_FINALIZADA_RELEVANTE, limiteFinalizadaRelevante } from "./motoristas"

describe("limiteFinalizadaRelevante", () => {
  it("subtrai HORAS_FINALIZADA_RELEVANTE horas do instante informado", () => {
    const agora = new Date("2026-07-10T12:00:00")
    const limite = limiteFinalizadaRelevante(agora)

    expect(limite.getTime()).toBe(agora.getTime() - HORAS_FINALIZADA_RELEVANTE * 60 * 60 * 1000)
  })

  it("a margem é maior que o maior descanso legal (35h), pra não cortar uma viagem FINALIZADA ainda relevante", () => {
    expect(HORAS_FINALIZADA_RELEVANTE).toBeGreaterThan(35)
  })
})
