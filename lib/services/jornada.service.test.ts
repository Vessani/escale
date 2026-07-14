import { describe, expect, it } from "vitest"
import {
  calcularCodigoJornadaNoDia,
  diferencaEmDias,
  mapearRegistrosJornada,
  obterStatusJornada,
  projetarCodigoNoDia,
} from "@/lib/services/jornada.service"

describe("jornada.service", () => {
  describe("mapearRegistrosJornada", () => {
    it("converte a data de coluna @db.Date (meia-noite UTC) para meia-noite local", () => {
      // Instante exato de meia-noite UTC do dia 9 — em fusos negativos, aplicar
      // uma conversão ingênua pra local desloca isso pro dia 8.
      const dataColunaUtc = new Date(Date.UTC(2026, 6, 9, 0, 0, 0))

      const [registro] = mapearRegistrosJornada([{ data: dataColunaUtc, codigo: 3 }])

      expect(registro.data.getFullYear()).toBe(2026)
      expect(registro.data.getMonth()).toBe(6)
      expect(registro.data.getDate()).toBe(9)
      expect(registro.codigo).toBe(3)
    })

    it("aceita tanto Date quanto string já serializada (vinda do cliente)", () => {
      const viaDate = mapearRegistrosJornada([{ data: new Date(Date.UTC(2026, 6, 9)), codigo: 5 }])
      const viaString = mapearRegistrosJornada([{ data: "2026-07-09T00:00:00.000Z", codigo: 5 }])

      expect(viaString[0].data.getTime()).toBe(viaDate[0].data.getTime())
    })

    it("preserva a ordem e a quantidade de registros", () => {
      const registros = mapearRegistrosJornada([
        { data: new Date(Date.UTC(2026, 6, 1)), codigo: 1 },
        { data: new Date(Date.UTC(2026, 6, 5)), codigo: 5 },
      ])

      expect(registros).toHaveLength(2)
      expect(registros[0].codigo).toBe(1)
      expect(registros[1].codigo).toBe(5)
    })
  })

  describe("diferencaEmDias", () => {
    it("conta dias inteiros ignorando a hora do dia", () => {
      expect(diferencaEmDias(new Date("2026-07-10T23:59:00"), new Date("2026-07-08T00:01:00"))).toBe(2)
    })

    it("retorna 0 para o mesmo dia calendário, mesmo com horas diferentes", () => {
      expect(diferencaEmDias(new Date("2026-07-10T23:00:00"), new Date("2026-07-10T01:00:00"))).toBe(0)
    })

    it("retorna negativo quando a primeira data é anterior à segunda", () => {
      expect(diferencaEmDias(new Date("2026-07-08T00:00:00"), new Date("2026-07-10T00:00:00"))).toBe(-2)
    })
  })

  describe("calcularCodigoJornadaNoDia", () => {
    const hoje = new Date("2026-07-08T10:00:00")

    it("avança o código conforme os dias entre hoje e o dia alvo", () => {
      expect(calcularCodigoJornadaNoDia(3, new Date("2026-07-09T10:00:00"), hoje)).toBe(4)
      expect(calcularCodigoJornadaNoDia(3, new Date("2026-07-10T10:00:00"), hoje)).toBe(5)
    })

    it("volta o código para dias anteriores a hoje", () => {
      expect(calcularCodigoJornadaNoDia(3, new Date("2026-07-07T10:00:00"), hoje)).toBe(2)
    })

    it("reinicia o ciclo em 1 no dia seguinte a uma Folga (código 7)", () => {
      expect(calcularCodigoJornadaNoDia(7, new Date("2026-07-09T10:00:00"), hoje)).toBe(1)
    })

    it("faz o ciclo dar a volta completa em 7 dias", () => {
      const seteDiasDepois = new Date("2026-07-15T10:00:00")
      expect(calcularCodigoJornadaNoDia(4, seteDiasDepois, hoje)).toBe(4)
    })

    it("não rotaciona os códigos especiais 8 (Férias), 9 (Exames) e 10 (Interno)", () => {
      const bemDepois = new Date("2026-08-01T10:00:00")
      expect(calcularCodigoJornadaNoDia(8, bemDepois, hoje)).toBe(8)
      expect(calcularCodigoJornadaNoDia(9, bemDepois, hoje)).toBe(9)
      expect(calcularCodigoJornadaNoDia(10, bemDepois, hoje)).toBe(10)
    })

    it("repassa sem alteração códigos fora da faixa 1-10 (dado inválido)", () => {
      expect(calcularCodigoJornadaNoDia(0, new Date("2026-07-09T10:00:00"), hoje)).toBe(0)
      expect(calcularCodigoJornadaNoDia(11, new Date("2026-07-09T10:00:00"), hoje)).toBe(11)
    })
  })

  describe("obterStatusJornada", () => {
    it("rotula os dias de trabalho de 1 a 6 com o número do dia", () => {
      for (let dia = 1; dia <= 6; dia++) {
        expect(obterStatusJornada(dia).texto).toBe(`${dia}º dia`)
      }
    })

    it("rotula os códigos especiais", () => {
      expect(obterStatusJornada(7).texto).toBe("Folga")
      expect(obterStatusJornada(8).texto).toBe("Férias")
      expect(obterStatusJornada(9).texto).toBe("Exames")
      expect(obterStatusJornada(10).texto).toBe("Interno")
    })

    it("usa o próprio número como texto para um código desconhecido", () => {
      expect(obterStatusJornada(99).texto).toBe("99")
    })
  })

  describe("projetarCodigoNoDia", () => {
    const hoje = new Date("2026-07-08T10:00:00")

    it("usa o registro exato do dia quando ele existe", () => {
      const registros = [{ data: new Date("2026-07-08T00:00:00"), codigo: 3 }]
      expect(projetarCodigoNoDia(registros, new Date("2026-07-08T00:00:00"), hoje, 1)).toBe(3)
    })

    it("projeta pra frente a partir do registro mais recente igual ou anterior ao dia pedido", () => {
      const registros = [{ data: new Date("2026-07-08T00:00:00"), codigo: 3 }]
      expect(projetarCodigoNoDia(registros, new Date("2026-07-10T00:00:00"), hoje, 1)).toBe(5)
    })

    it("projeta pra trás quando o dia pedido é anterior ao registro mais antigo", () => {
      const registros = [{ data: new Date("2026-07-08T00:00:00"), codigo: 3 }]
      expect(projetarCodigoNoDia(registros, new Date("2026-07-06T00:00:00"), hoje, 1)).toBe(1)
    })

    it("escolhe o registro mais próximo (não necessariamente o último) quando há vários no histórico", () => {
      const registros = [
        { data: new Date("2026-07-01T00:00:00"), codigo: 5 },
        { data: new Date("2026-07-08T00:00:00"), codigo: 3 },
        { data: new Date("2026-07-20T00:00:00"), codigo: 2 },
      ]
      // Dia 10 fica entre o registro de dia 8 e o de dia 20: âncora é o de dia 8.
      expect(projetarCodigoNoDia(registros, new Date("2026-07-10T00:00:00"), hoje, 1)).toBe(5)
    })

    it("editar um dia futuro não muda a projeção de hoje nem de dias anteriores", () => {
      // Caso relatado pelo usuário: hoje é dia 3, e amanhã é marcado manualmente como Folga.
      const registros = [
        { data: new Date("2026-07-08T00:00:00"), codigo: 3 },
        { data: new Date("2026-07-09T00:00:00"), codigo: 7 },
      ]

      expect(projetarCodigoNoDia(registros, new Date("2026-07-08T00:00:00"), hoje, 1)).toBe(3)
      expect(projetarCodigoNoDia(registros, new Date("2026-07-07T00:00:00"), hoje, 1)).toBe(2)
    })

    it("reinicia o ciclo no dia seguinte a uma folga inserida manualmente no meio da semana", () => {
      const registros = [
        { data: new Date("2026-07-08T00:00:00"), codigo: 3 },
        { data: new Date("2026-07-09T00:00:00"), codigo: 7 },
      ]

      expect(projetarCodigoNoDia(registros, new Date("2026-07-09T00:00:00"), hoje, 1)).toBe(7)
      expect(projetarCodigoNoDia(registros, new Date("2026-07-10T00:00:00"), hoje, 1)).toBe(1)
      expect(projetarCodigoNoDia(registros, new Date("2026-07-11T00:00:00"), hoje, 1)).toBe(2)
    })

    it("sem nenhum registro no histórico, cai no fallback rotacionado a partir de hoje", () => {
      expect(projetarCodigoNoDia([], new Date("2026-07-08T00:00:00"), hoje, 3)).toBe(3)
      expect(projetarCodigoNoDia([], new Date("2026-07-10T00:00:00"), hoje, 3)).toBe(5)
    })

    it("é indiferente à ordem dos registros na lista de entrada", () => {
      const registrosEmOrdem = [
        { data: new Date("2026-07-01T00:00:00"), codigo: 5 },
        { data: new Date("2026-07-08T00:00:00"), codigo: 3 },
      ]
      const registrosForaDeOrdem = [...registrosEmOrdem].reverse()

      const dia = new Date("2026-07-10T00:00:00")
      expect(projetarCodigoNoDia(registrosForaDeOrdem, dia, hoje, 1)).toBe(
        projetarCodigoNoDia(registrosEmOrdem, dia, hoje, 1),
      )
    })
  })
})
