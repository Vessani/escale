import { describe, expect, it } from "vitest"
import { TOLERANCIA_SAIDA_MINUTOS, minutosDeAtraso, saidaAtrasada } from "./pontualidade"

describe("pontualidade da saída", () => {
  it("conta minutos entre o previsto e a saída real (negativo = saiu antes), aceitando texto ISO", () => {
    expect(minutosDeAtraso(new Date("2026-10-02T07:00:00-03:00"), new Date("2026-10-02T07:40:00-03:00"))).toBe(40)
    expect(minutosDeAtraso("2026-10-02T10:00:00.000Z", "2026-10-02T09:50:00.000Z")).toBe(-10)
  })

  it(`até ${TOLERANCIA_SAIDA_MINUTOS} min de atraso ainda é no horário`, () => {
    expect(saidaAtrasada(TOLERANCIA_SAIDA_MINUTOS)).toBe(false)
    expect(saidaAtrasada(TOLERANCIA_SAIDA_MINUTOS + 1)).toBe(true)
    expect(saidaAtrasada(-30)).toBe(false)
  })
})
