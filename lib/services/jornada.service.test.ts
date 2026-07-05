import { describe, expect, it } from "vitest"
import {
  calcularCodigoAtualPorCodigoNoDia,
  calcularCodigoJornadaNoDia,
  diferencaEmDias,
  obterStatusJornada,
} from "@/lib/services/jornada.service"

describe("jornada.service", () => {
  it("calcula diferença de dias ignorando hora", () => {
    const dataA = new Date("2026-07-10T23:59:00")
    const dataB = new Date("2026-07-08T00:01:00")

    expect(diferencaEmDias(dataA, dataB)).toBe(2)
  })

  it("aplica rotação do código 1..7 ao longo dos dias", () => {
    const hoje = new Date("2026-07-04T10:00:00")
    const diaFuturo = new Date("2026-07-06T08:00:00")

    expect(calcularCodigoJornadaNoDia(5, diaFuturo, hoje)).toBe(7)
  })

  it("mantém códigos especiais 8..10 sem rotação", () => {
    const hoje = new Date("2026-07-04T10:00:00")
    const outroDia = new Date("2026-07-10T08:00:00")

    expect(calcularCodigoJornadaNoDia(8, outroDia, hoje)).toBe(8)
    expect(calcularCodigoJornadaNoDia(9, outroDia, hoje)).toBe(9)
    expect(calcularCodigoJornadaNoDia(10, outroDia, hoje)).toBe(10)
  })

  it("obtém código atual inverso a partir de um dia selecionado", () => {
    const hoje = new Date("2026-07-04T10:00:00")
    const diaSelecionado = new Date("2026-07-07T00:00:00")

    expect(calcularCodigoAtualPorCodigoNoDia(1, diaSelecionado, hoje)).toBe(5)
  })

  it("retorna labels de status corretos", () => {
    expect(obterStatusJornada(7).texto).toBe("Folga")
    expect(obterStatusJornada(8).texto).toBe("Férias")
  })
})
