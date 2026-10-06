import { describe, expect, it } from "vitest"
import { diaCurto, diasEntre, rotuloDia, semEdicoesDe } from "./conferencia-formato"

describe("conferencia-formato", () => {
  it("dia da coluna em Brasília, com o dia da semana", () => {
    expect(rotuloDia("2026-09-01T03:00:00.000Z")).toBe("01/09 · terça-feira")
    expect(diaCurto("2026-09-01T03:00:00.000Z")).toEqual({ data: "01/09", semana: "ter" })
  })

  it("jornada que vira a noite: +1 dia no fim", () => {
    expect(diasEntre("2026-09-01T21:00:00-03:00", "2026-09-02T05:00:00-03:00")).toBe(1)
    expect(diasEntre("2026-09-01T06:00:00-03:00", "2026-09-01T18:00:00-03:00")).toBe(0)
  })

  it("desfazer tira só as edições das linhas do arquivo daquela jornada", () => {
    const edicoes = {
      ignoradas: [1, 2, 9],
      semCorrecao: [2, 8],
      horarios: { 1: { inicio: "a", fim: "b" }, 9: { inicio: "c", fim: "d" } },
      dias: { 5: 3, 6: 4 },
    }
    expect(semEdicoesDe(edicoes, 5, [1, 2])).toEqual({
      ignoradas: [9],
      semCorrecao: [8],
      horarios: { 9: { inicio: "c", fim: "d" } },
      dias: { 6: 4 },
    })
  })
})
