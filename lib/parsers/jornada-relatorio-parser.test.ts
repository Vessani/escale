process.env.TZ = "America/Sao_Paulo"

import { describe, expect, it } from "vitest"
import { JornadaRelatorioParser } from "@/lib/parsers/jornada-relatorio-parser"

type LinhaFake = Record<string, unknown>

/** 3 linhas de cabeçalho fixas (título, período, nomes de coluna) — sempre ignoradas pelo extrator. */
function comCabecalho(...linhasDeDados: LinhaFake[]): LinhaFake[] {
  return [
    { A: "Relatório Sintético de Jornada" },
    { A: "01/07/2026 00:00:00 à 17/07/2026 23:59:59" },
    { A: "Matrícula", B: "Motorista", C: "Início de Jornada", F: "Fim de Jornada" },
    ...linhasDeDados,
  ]
}

function linha(matricula: string | number, inicio: string, fim: string, diasSemFolga: string | number = 3): LinhaFake {
  return { A: matricula, B: "Nome Qualquer", C: inicio, F: fim, J: diasSemFolga }
}

describe("jornada-relatorio-parser", () => {
  it("na mesma matrícula e mesmo dia, mantém só a jornada com início mais recente", () => {
    const linhas = comCabecalho(
      linha(815, "10/07/2026 01:10:08", "10/07/2026 02:00:00"),
      linha(815, "10/07/2026 20:15:00", "11/07/2026 03:52:45"),
    )

    const resultado = JornadaRelatorioParser.extrairDeLinhas(linhas)

    expect(resultado).toHaveLength(1)
    expect(resultado[0].matricula).toBe(815)
    expect(resultado[0].inicioJornada).toBe(new Date(2026, 6, 10, 20, 15, 0).toISOString())
  })

  it("mantém todas as jornadas de dias diferentes da mesma matrícula — o relatório lista vários turnos por motorista", () => {
    const linhas = comCabecalho(
      linha(815, "01/07/2026 21:09:49", "02/07/2026 05:04:14"),
      linha(815, "10/07/2026 01:10:08", "10/07/2026 05:52:45"),
      linha(815, "05/07/2026 22:51:20", "06/07/2026 05:02:06"),
    )

    const resultado = JornadaRelatorioParser.extrairDeLinhas(linhas)

    expect(resultado).toHaveLength(3)
    expect(resultado.every((r) => r.matricula === 815)).toBe(true)
  })

  it("retorna um registro por (matrícula, dia) — dias diferentes da mesma matrícula não são descartados", () => {
    const linhas = comCabecalho(
      linha(398, "12/07/2026 12:36:45", "12/07/2026 12:39:34"),
      linha(261, "01/07/2026 04:37:24", "01/07/2026 17:24:58"),
      linha(261, "08/07/2026 04:37:03", "08/07/2026 16:19:35"),
    )

    const resultado = JornadaRelatorioParser.extrairDeLinhas(linhas)

    expect(resultado).toHaveLength(3)
    const registros261 = resultado.filter((r) => r.matricula === 261)
    expect(registros261).toHaveLength(2)
  })

  it("soma corretamente múltiplas matrículas, cada uma com múltiplos dias", () => {
    const linhas = comCabecalho(
      linha(111, "01/07/2026 08:00:00", "01/07/2026 18:00:00"),
      linha(111, "02/07/2026 08:00:00", "02/07/2026 18:00:00"),
      linha(222, "01/07/2026 20:00:00", "02/07/2026 04:00:00"),
      linha(222, "02/07/2026 20:00:00", "03/07/2026 04:00:00"),
      linha(222, "03/07/2026 20:00:00", "04/07/2026 04:00:00"),
    )

    const resultado = JornadaRelatorioParser.extrairDeLinhas(linhas)

    expect(resultado).toHaveLength(5)
  })

  it("ignora as 3 primeiras linhas (título/período/cabeçalho), mesmo que pareçam dado válido", () => {
    const linhas = [
      { A: "999", C: "01/01/2026 00:00:00", F: "01/01/2026 01:00:00" }, // linha 0 — ignorada
      { A: "998", C: "01/01/2026 00:00:00", F: "01/01/2026 01:00:00" }, // linha 1 — ignorada
      { A: "Matrícula", B: "Motorista", C: "Início de Jornada", F: "Fim de Jornada" }, // linha 2 — ignorada
      linha(815, "10/07/2026 01:10:08", "10/07/2026 05:52:45"), // linha 3 — primeira linha de dado de verdade
    ]

    const resultado = JornadaRelatorioParser.extrairDeLinhas(linhas)

    expect(resultado.some((r) => r.matricula === 999 || r.matricula === 998)).toBe(false)
    expect(resultado.some((r) => r.matricula === 815)).toBe(true)
  })

  it("ignora linha sem matrícula numérica", () => {
    const linhas = comCabecalho(
      { A: "", B: "Sem matrícula", C: "10/07/2026 01:10:08", F: "10/07/2026 05:52:45" },
      { A: "abc", B: "Matrícula não numérica", C: "10/07/2026 01:10:08", F: "10/07/2026 05:52:45" },
      linha(815, "10/07/2026 01:10:08", "10/07/2026 05:52:45"),
    )

    const resultado = JornadaRelatorioParser.extrairDeLinhas(linhas)

    expect(resultado).toHaveLength(1)
    expect(resultado[0].matricula).toBe(815)
  })

  it("ignora linha com data em formato inválido, sem derrubar o import inteiro", () => {
    const linhas = comCabecalho(
      linha(111, "não é uma data", "10/07/2026 05:52:45"),
      linha(815, "10/07/2026 01:10:08", "10/07/2026 05:52:45"),
    )

    const resultado = JornadaRelatorioParser.extrairDeLinhas(linhas)

    expect(resultado).toHaveLength(1)
    expect(resultado[0].matricula).toBe(815)
  })

  it("lança erro quando nenhum registro válido é encontrado", () => {
    const linhas = comCabecalho({ A: "", C: "", F: "" })

    expect(() => JornadaRelatorioParser.extrairDeLinhas(linhas)).toThrow(
      "Nenhum registro de jornada encontrado no relatório. Verifique se a coluna A contém a matrícula.",
    )
  })

  it("dia é a meia-noite local do dia de Início de Jornada", () => {
    const linhas = comCabecalho(linha(815, "10/07/2026 23:45:00", "11/07/2026 02:00:00"))

    const resultado = JornadaRelatorioParser.extrairDeLinhas(linhas)

    expect(resultado[0].dia).toBe(new Date(2026, 6, 10, 0, 0, 0, 0).toISOString())
  })

  it("extrai diasSemFolga da coluna J", () => {
    const linhas = comCabecalho(linha(815, "10/07/2026 01:10:08", "10/07/2026 05:52:45", 4))

    const resultado = JornadaRelatorioParser.extrairDeLinhas(linhas)

    expect(resultado[0].diasSemFolga).toBe(4)
  })

  it("ignora linha sem diasSemFolga numérico (coluna J ausente ou inválida)", () => {
    const linhas = comCabecalho(
      { A: "111", B: "Sem coluna J", C: "10/07/2026 01:10:08", F: "10/07/2026 05:52:45" },
      linha(815, "10/07/2026 01:10:08", "10/07/2026 05:52:45"),
    )

    const resultado = JornadaRelatorioParser.extrairDeLinhas(linhas)

    expect(resultado).toHaveLength(1)
    expect(resultado[0].matricula).toBe(815)
  })

  describe("entrada e saída registradas em linhas separadas", () => {
    /** Caso real da matrícula 304: cada batida de ~1 minuto virou uma linha, somando +1 em "Dias Sem Folga". */
    const linhas304 = comCabecalho(
      linha(304, "05/09/2026 05:44:53", "05/09/2026 05:45:53", 4),
      linha(304, "05/09/2026 17:19:12", "05/09/2026 17:20:11", 5),
      linha(304, "06/09/2026 05:54:29", "06/09/2026 05:55:28", 6),
      linha(304, "06/09/2026 17:27:12", "06/09/2026 17:28:12", 7),
      linha(304, "14/09/2026 05:46:13", "14/09/2026 05:47:12", 5),
      linha(304, "14/09/2026 17:12:42", "14/09/2026 17:13:25", 6),
      linha(304, "29/09/2026 04:52:34", "29/09/2026 04:53:34", 4),
    )

    function extrairOrdenado(linhas: LinhaFake[]) {
      return JornadaRelatorioParser.extrairDeLinhas(linhas).sort((a, b) => a.dia.localeCompare(b.dia))
    }

    function doDia(resultado: ReturnType<typeof extrairOrdenado>, ano: number, mes: number, dia: number) {
      const registro = resultado.find((r) => r.dia === new Date(ano, mes - 1, dia).toISOString())
      if (!registro) throw new Error(`sem registro em ${dia}/${mes}/${ano}`)
      return registro
    }

    it("junta entrada e saída do mesmo dia numa jornada só", () => {
      const registro = doDia(extrairOrdenado(linhas304), 2026, 9, 5)

      expect(registro.inicioJornada).toBe(new Date(2026, 8, 5, 5, 44, 53).toISOString())
      expect(registro.fimJornada).toBe(new Date(2026, 8, 5, 17, 20, 11).toISOString())
      expect(registro.correcao).toBe("BATIDAS_UNIDAS")
    })

    it("desconta de Dias Sem Folga o +1 que a linha extra somou", () => {
      const resultado = extrairOrdenado(linhas304)

      expect(doDia(resultado, 2026, 9, 5).diasSemFolga).toBe(4)
      const dia6 = doDia(resultado, 2026, 9, 6)
      expect(dia6.diasSemFolga).toBe(5)
      expect(dia6.diasSemFolgaRelatorio).toBe(6)
    })

    it("zera a correção depois de uma folga", () => {
      expect(doDia(extrairOrdenado(linhas304), 2026, 9, 14).diasSemFolga).toBe(5)
    })

    it("batida sem par conta como dia trabalhado, marcada", () => {
      const resultado = extrairOrdenado(linhas304)

      expect(resultado).toHaveLength(4)
      const dia29 = doDia(resultado, 2026, 9, 29)
      expect(dia29.diasSemFolga).toBe(4)
      expect(dia29.correcao).toBe("BATIDA_SEM_PAR")
    })

    it("corrige também as linhas normais seguintes da mesma sequência, até a folga", () => {
      const resultado = extrairOrdenado(
        comCabecalho(
          linha(304, "05/09/2026 05:44:53", "05/09/2026 05:45:53", 4),
          linha(304, "05/09/2026 17:19:12", "05/09/2026 17:20:11", 5),
          linha(304, "06/09/2026 05:00:00", "06/09/2026 17:00:00", 6),
          linha(304, "09/09/2026 05:00:00", "09/09/2026 17:00:00", 1),
        ),
      )

      const dia6 = doDia(resultado, 2026, 9, 6)
      expect(dia6.diasSemFolga).toBe(5)
      expect(dia6.correcao).toBeNull()
      expect(doDia(resultado, 2026, 9, 9).diasSemFolga).toBe(1)
    })

    it("não une batidas com mais de 20h entre elas", () => {
      const resultado = extrairOrdenado(
        comCabecalho(
          linha(304, "05/09/2026 05:44:53", "05/09/2026 05:45:53", 4),
          linha(304, "06/09/2026 05:54:29", "06/09/2026 05:55:28", 5),
        ),
      )

      expect(resultado).toHaveLength(2)
      expect(resultado.map((r) => r.correcao)).toEqual(["BATIDA_SEM_PAR", "BATIDA_SEM_PAR"])
      expect(resultado.map((r) => r.diasSemFolga)).toEqual([4, 5])
    })

    it("não altera linhas normais", () => {
      const resultado = extrairOrdenado(
        comCabecalho(
          linha(261, "01/07/2026 04:37:24", "01/07/2026 17:24:58", 2),
          linha(261, "02/07/2026 04:37:03", "02/07/2026 16:19:35", 3),
        ),
      )

      expect(resultado.map((r) => r.correcao)).toEqual([null, null])
      expect(resultado.map((r) => r.diasSemFolga)).toEqual([2, 3])
      expect(resultado.map((r) => r.diasSemFolgaRelatorio)).toEqual([2, 3])
    })
  })
})
