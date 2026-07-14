import { describe, expect, it } from "vitest"
import {
  formatarDataDia,
  formatarIntervaloDias,
  gerarJanelaDias,
  parseDataInicioParam,
  statusJornadaCorrespondeAoFiltro,
  TAMANHO_JANELA_CALENDARIO,
} from "./calendario-utils"

describe("calendario-utils", () => {
  describe("statusJornadaCorrespondeAoFiltro", () => {
    it("aceita qualquer código quando o filtro é TODOS", () => {
      expect(statusJornadaCorrespondeAoFiltro(1, "TODOS")).toBe(true)
      expect(statusJornadaCorrespondeAoFiltro(10, "TODOS")).toBe(true)
    })

    it("filtra a faixa 1-3", () => {
      expect(statusJornadaCorrespondeAoFiltro(1, "JORNADA_1_3")).toBe(true)
      expect(statusJornadaCorrespondeAoFiltro(3, "JORNADA_1_3")).toBe(true)
      expect(statusJornadaCorrespondeAoFiltro(4, "JORNADA_1_3")).toBe(false)
    })

    it("filtra a faixa 4-5", () => {
      expect(statusJornadaCorrespondeAoFiltro(4, "JORNADA_4_5")).toBe(true)
      expect(statusJornadaCorrespondeAoFiltro(5, "JORNADA_4_5")).toBe(true)
      expect(statusJornadaCorrespondeAoFiltro(6, "JORNADA_4_5")).toBe(false)
    })

    it("filtra cada status exato (6, Folga, Férias, Exames, Interno)", () => {
      expect(statusJornadaCorrespondeAoFiltro(6, "JORNADA_6")).toBe(true)
      expect(statusJornadaCorrespondeAoFiltro(7, "FOLGA")).toBe(true)
      expect(statusJornadaCorrespondeAoFiltro(8, "FERIAS")).toBe(true)
      expect(statusJornadaCorrespondeAoFiltro(9, "EXAMES")).toBe(true)
      expect(statusJornadaCorrespondeAoFiltro(10, "INTERNO")).toBe(true)
    })

    it("nega quando o código não corresponde ao filtro pedido", () => {
      expect(statusJornadaCorrespondeAoFiltro(7, "JORNADA_6")).toBe(false)
      expect(statusJornadaCorrespondeAoFiltro(6, "FOLGA")).toBe(false)
      expect(statusJornadaCorrespondeAoFiltro(1, "INTERNO")).toBe(false)
    })
  })

  describe("parseDataInicioParam", () => {
    it("aceita 'YYYY-MM-DD' válido e retorna meia-noite local daquele dia", () => {
      const resultado = parseDataInicioParam("2026-07-09")
      expect(resultado).not.toBeNull()
      expect(resultado?.getFullYear()).toBe(2026)
      expect(resultado?.getMonth()).toBe(6) // julho = índice 6
      expect(resultado?.getDate()).toBe(9)
      expect(resultado?.getHours()).toBe(0)
    })

    it("rejeita formatos que não batem com 'YYYY-MM-DD'", () => {
      expect(parseDataInicioParam(undefined)).toBeNull()
      expect(parseDataInicioParam("")).toBeNull()
      expect(parseDataInicioParam("2026-07")).toBeNull()
      expect(parseDataInicioParam("09-07-2026")).toBeNull()
      expect(parseDataInicioParam("data-invalida")).toBeNull()
    })

    it("rejeita uma data que não existe", () => {
      expect(parseDataInicioParam("2026-02-30")).toBeNull()
    })
  })

  describe("formatarDataDia", () => {
    it("formata a data como 'YYYY-MM-DD' com dia e mês em dois dígitos", () => {
      expect(formatarDataDia(new Date(2026, 0, 5))).toBe("2026-01-05")
      expect(formatarDataDia(new Date(2026, 11, 31))).toBe("2026-12-31")
    })
  })

  describe("gerarJanelaDias", () => {
    it("gera a quantidade pedida de dias consecutivos, começando no dia informado", () => {
      const dias = gerarJanelaDias(new Date(2026, 6, 28), 5) // 28 jul, atravessa o mês

      expect(dias).toHaveLength(5)
      expect(formatarDataDia(dias[0])).toBe("2026-07-28")
      expect(formatarDataDia(dias[1])).toBe("2026-07-29")
      expect(formatarDataDia(dias[2])).toBe("2026-07-30")
      expect(formatarDataDia(dias[3])).toBe("2026-07-31")
      expect(formatarDataDia(dias[4])).toBe("2026-08-01")
    })

    it("usa o tamanho padrão de janela do calendário (30 dias)", () => {
      expect(TAMANHO_JANELA_CALENDARIO).toBe(30)
      expect(gerarJanelaDias(new Date(2026, 0, 1), TAMANHO_JANELA_CALENDARIO)).toHaveLength(30)
    })
  })

  describe("formatarIntervaloDias", () => {
    it("omite o ano do início quando início e fim são do mesmo ano", () => {
      const rotulo = formatarIntervaloDias(new Date(2026, 6, 9), new Date(2026, 7, 7))
      expect(rotulo).not.toMatch(/2026.*–/) // ano não aparece antes do "–"
      expect(rotulo).toMatch(/2026$/) // mas aparece no final
    })

    it("mostra o ano nos dois lados quando o intervalo atravessa a virada do ano", () => {
      const rotulo = formatarIntervaloDias(new Date(2026, 11, 20), new Date(2027, 0, 18))
      expect(rotulo).toMatch(/2026.*–.*2027/)
    })
  })
})
