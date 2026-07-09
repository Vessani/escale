import { describe, expect, it } from "vitest"
import {
  calcularCodigoJornadaNoDia,
  diferencaEmDias,
  obterStatusJornada,
  projetarCodigoNoDia,
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

  it("retorna labels de status corretos", () => {
    expect(obterStatusJornada(7).texto).toBe("Folga")
    expect(obterStatusJornada(8).texto).toBe("Férias")
  })

  describe("projetarCodigoNoDia", () => {
    it("usa o registro exato do dia quando ele existe", () => {
      const hoje = new Date("2026-07-08T10:00:00")
      const registros = [{ data: new Date("2026-07-08T00:00:00"), codigo: 3 }]

      expect(projetarCodigoNoDia(registros, new Date("2026-07-08T00:00:00"), hoje, 1)).toBe(3)
    })

    it("projeta a partir do registro mais recente igual ou anterior ao dia", () => {
      const hoje = new Date("2026-07-08T10:00:00")
      const registros = [{ data: new Date("2026-07-08T00:00:00"), codigo: 3 }]

      // 2 dias depois do registro (dia 3), rotacionando: 3 -> 4 -> 5
      expect(projetarCodigoNoDia(registros, new Date("2026-07-10T00:00:00"), hoje, 1)).toBe(5)
    })

    it("edição de um dia futuro não altera a projeção de hoje nem de dias anteriores a ela", () => {
      // Caso real relatado: hoje é dia 3, e amanhã é marcado manualmente como Folga (7).
      const hoje = new Date("2026-07-08T10:00:00")
      const registros = [
        { data: new Date("2026-07-08T00:00:00"), codigo: 3 }, // registro de hoje, já existia
        { data: new Date("2026-07-09T00:00:00"), codigo: 7 }, // edição: amanhã vira Folga
      ]

      expect(projetarCodigoNoDia(registros, new Date("2026-07-08T00:00:00"), hoje, 1)).toBe(3) // hoje intacto
      expect(projetarCodigoNoDia(registros, new Date("2026-07-09T00:00:00"), hoje, 1)).toBe(7) // amanhã = Folga
    })

    it("reinicia o ciclo no 1º dia a partir do dia seguinte a uma folga inserida manualmente", () => {
      const hoje = new Date("2026-07-08T10:00:00")
      const registros = [
        { data: new Date("2026-07-08T00:00:00"), codigo: 3 },
        { data: new Date("2026-07-09T00:00:00"), codigo: 7 }, // folga inserida manualmente
      ]

      // Depois da folga inserida, o próximo dia reinicia no 1º dia do ciclo
      expect(projetarCodigoNoDia(registros, new Date("2026-07-10T00:00:00"), hoje, 1)).toBe(1)
      expect(projetarCodigoNoDia(registros, new Date("2026-07-11T00:00:00"), hoje, 1)).toBe(2)
    })

    it("projeta a partir do registro mais antigo quando o dia é anterior a todo o histórico", () => {
      const hoje = new Date("2026-07-08T10:00:00")
      const registros = [{ data: new Date("2026-07-08T00:00:00"), codigo: 3 }]

      // 2 dias antes do registro: 3 -> 2 -> 1
      expect(projetarCodigoNoDia(registros, new Date("2026-07-06T00:00:00"), hoje, 1)).toBe(1)
    })

    it("sem nenhum registro, cai no fallback rotacionado a partir de hoje (comportamento antigo)", () => {
      const hoje = new Date("2026-07-08T10:00:00")

      expect(projetarCodigoNoDia([], new Date("2026-07-08T00:00:00"), hoje, 3)).toBe(3)
      expect(projetarCodigoNoDia([], new Date("2026-07-10T00:00:00"), hoje, 3)).toBe(5)
    })
  })
})
