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
  it("pega o registro mais recente quando há várias jornadas pra mesma matrícula", () => {
    const linhas = comCabecalho(
      linha(815, "01/07/2026 21:09:49", "02/07/2026 05:04:14"),
      linha(815, "10/07/2026 01:10:08", "10/07/2026 05:52:45"),
      linha(815, "05/07/2026 22:51:20", "06/07/2026 05:02:06"),
    )

    const resultado = JornadaRelatorioParser.extrairDeLinhas(linhas)

    expect(resultado).toHaveLength(1)
    expect(resultado[0].matricula).toBe(815)
    expect(resultado[0].inicioJornada).toBe(new Date(2026, 6, 10, 1, 10, 8).toISOString())
  })

  it("retorna um registro por matrícula, cada um com sua própria jornada mais recente", () => {
    const linhas = comCabecalho(
      linha(398, "12/07/2026 12:36:45", "12/07/2026 12:39:34"),
      linha(261, "01/07/2026 04:37:24", "01/07/2026 17:24:58"),
      linha(261, "08/07/2026 04:37:03", "08/07/2026 16:19:35"),
    )

    const resultado = JornadaRelatorioParser.extrairDeLinhas(linhas)

    expect(resultado).toHaveLength(2)
    const registro261 = resultado.find((r) => r.matricula === 261)
    expect(registro261?.inicioJornada).toBe(new Date(2026, 6, 8, 4, 37, 3).toISOString())
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
})
