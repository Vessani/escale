process.env.TZ = "America/Sao_Paulo"

import { describe, expect, it } from "vitest"
import { JornadaRelatorioParser, SEM_EDICOES, registrosParaImportar } from "@/lib/parsers/jornada-relatorio-parser"

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

    it("depois de 35h ou mais sem jornada a contagem recomeça em 1 (no relatório real ele sempre volta pra 1 nesse caso)", () => {
      expect(doDia(extrairOrdenado(linhas304), 2026, 9, 14).diasSemFolga).toBe(1)
    })

    it("batida sem par conta como dia trabalhado, marcada", () => {
      const resultado = extrairOrdenado(linhas304)

      expect(resultado).toHaveLength(4)
      const dia29 = doDia(resultado, 2026, 9, 29)
      expect(dia29.diasSemFolga).toBe(1)
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

// Casos tirados do relatório real de set/2026 (nomes trocados).
describe("jornada-relatorio-parser — batidas e conferência", () => {
  // Jornada real 05:51–14:20 (4º dia) e, 1h12 depois, uma batida solta (o relatório contou como 5º dia).
  const batidaExtra = comCabecalho(
    linha(101, "16/09/2026 07:06:03", "16/09/2026 17:48:31", 3),
    linha(101, "17/09/2026 05:51:27", "17/09/2026 14:20:53", 4),
    linha(101, "17/09/2026 15:32:43", "17/09/2026 15:33:42", 5),
    linha(101, "18/09/2026 09:25:47", "18/09/2026 20:29:43", 6),
    linha(101, "19/09/2026 07:40:19", "19/09/2026 18:02:33", 7),
  )

  it("batida solta logo depois da jornada não apaga a jornada real nem soma um dia (7º dia falso)", () => {
    const linhas = JornadaRelatorioParser.processar(JornadaRelatorioParser.extrairLinhas(batidaExtra))
    const importar = registrosParaImportar(linhas)

    expect(importar.map((r) => [new Date(r.inicioJornada).getHours(), r.diasSemFolga])).toEqual([
      [7, 3],
      [5, 4],
      [9, 5],
      [7, 6],
    ])
    expect(importar[1]).toMatchObject({ correcao: "BATIDA_EXTRA", fimJornada: new Date(2026, 8, 17, 14, 20, 53).toISOString() })
    expect(linhas.find((l) => l.situacao === "ABSORVIDA")).toMatchObject({ diasSemFolgaRelatorio: 5 })
    expect(linhas.find((l) => l.correcao === "BATIDA_EXTRA")?.batidaExtra).toBe("15:32")
  })

  it("entrada em batida e saída numa linha curta (28 min) viram uma jornada só", () => {
    const resultado = JornadaRelatorioParser.extrairDeLinhas(
      comCabecalho(
        linha(900, "07/09/2026 18:39:00", "08/09/2026 06:13:00", 5),
        linha(900, "08/09/2026 18:59:00", "08/09/2026 19:00:00", 6),
        linha(900, "09/09/2026 06:10:00", "09/09/2026 06:38:00", 7),
        linha(900, "09/09/2026 18:49:00", "10/09/2026 06:10:00", 8),
      ),
    )

    expect(resultado.map((r) => r.diasSemFolga)).toEqual([5, 6, 7])
    expect(resultado[1]).toMatchObject({ correcao: "BATIDAS_UNIDAS", fimJornada: new Date(2026, 8, 9, 6, 38).toISOString() })
  })

  it("duas jornadas reais no mesmo dia: as duas aparecem, só a mais tarde vai pro calendário", () => {
    const linhas = JornadaRelatorioParser.processar(
      JornadaRelatorioParser.extrairLinhas(
        comCabecalho(
          linha(815, "05/09/2026 01:58:00", "05/09/2026 03:22:00", 2),
          linha(815, "05/09/2026 22:02:00", "06/09/2026 06:12:00", 3),
        ),
      ),
    )

    expect(linhas.map((l) => l.situacao)).toEqual(["MESMO_DIA", "IMPORTAR"])
  })

  it("ignorar uma linha tira ela da contagem; se ficar 35h sem jornada, conta como folga", () => {
    const brutas = JornadaRelatorioParser.extrairLinhas(
      comCabecalho(
        linha(500, "01/09/2026 06:00:00", "01/09/2026 16:00:00", 4),
        linha(500, "01/09/2026 20:00:00", "01/09/2026 20:40:00", 5),
        linha(500, "02/09/2026 06:00:00", "02/09/2026 16:00:00", 6),
        linha(500, "03/09/2026 06:00:00", "03/09/2026 16:00:00", 7),
      ),
    )
    const [, passagem, dia02] = brutas

    // Passagem de 40 min na base não era jornada: sai da contagem.
    const semPassagem = registrosParaImportar(JornadaRelatorioParser.processar(brutas, { ...SEM_EDICOES, ignoradas: [passagem.id] }))
    expect(semPassagem.map((r) => r.diasSemFolga)).toEqual([4, 5, 6])

    // Sem a passagem e sem o dia 02 → 38h parado depois do dia 01 = folga; o dia 03 vira 1º dia.
    const semDia02 = registrosParaImportar(JornadaRelatorioParser.processar(brutas, { ...SEM_EDICOES, ignoradas: [passagem.id, dia02.id] }))
    expect(semDia02.map((r) => r.diasSemFolga)).toEqual([4, 1])
  })

  it("ajuste manual de dias desloca as linhas seguintes até a próxima folga", () => {
    const brutas = JornadaRelatorioParser.extrairLinhas(
      comCabecalho(
        linha(500, "01/09/2026 06:00:00", "01/09/2026 16:00:00", 5),
        linha(500, "02/09/2026 06:00:00", "02/09/2026 16:00:00", 6),
        linha(500, "03/09/2026 06:00:00", "03/09/2026 16:00:00", 7),
        linha(500, "06/09/2026 06:00:00", "06/09/2026 16:00:00", 1),
      ),
    )

    const linhas = JornadaRelatorioParser.processar(brutas, { ...SEM_EDICOES, dias: { [brutas[0].id]: 3 } })
    expect(linhas.map((l) => l.diasSemFolga)).toEqual([3, 4, 5, 1])
    expect(linhas.map((l) => l.editada)).toEqual([true, false, false, false])
  })

  it("horário corrigido vale pra jornada; desfazer a correção mantém a batida como jornada", () => {
    const brutas = JornadaRelatorioParser.extrairLinhas(batidaExtra)
    const batida = brutas[2]

    const corrigida = JornadaRelatorioParser.processar(brutas, {
      ...SEM_EDICOES,
      horarios: { [batida.id]: { inicio: batida.inicio, fim: new Date(2026, 8, 17, 18, 0).toISOString() } },
    })
    // Com fim às 18:00 não é mais batida: vira jornada (e o dia 17 fica com a mais tarde).
    expect(corrigida.find((l) => l.id === batida.id)).toMatchObject({ situacao: "IMPORTAR", editada: true, diasSemFolga: 5 })

    const semCorrecao = JornadaRelatorioParser.processar(brutas, { ...SEM_EDICOES, semCorrecao: [batida.id] })
    expect(semCorrecao.find((l) => l.id === batida.id)).toMatchObject({ situacao: "IMPORTAR", correcao: null })
    expect(semCorrecao.at(-1)?.diasSemFolga).toBe(7)
  })
})
