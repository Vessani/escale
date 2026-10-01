import { describe, expect, it } from "vitest"
import ExcelJS from "exceljs"
import { lerPrimeiraAba, validarArquivoPlanilha } from "./ler-arquivo-planilha"

async function planilha(montar: (aba: ExcelJS.Worksheet) => void): Promise<ArrayBuffer> {
  const workbook = new ExcelJS.Workbook()
  montar(workbook.addWorksheet("Plan1"))
  workbook.addWorksheet("Outra").getCell("A1").value = "ignorada"
  const buffer = await workbook.xlsx.writeBuffer()
  return buffer as ArrayBuffer
}

describe("lerPrimeiraAba", () => {
  it("devolve as linhas não vazias da primeira aba como { A, B, ... }, igual à leitura anterior", async () => {
    const dados = await planilha((aba) => {
      aba.getCell("A1").value = "Relatório"
      aba.getCell("A3").value = 261 // linha 2 vazia: some
      aba.getCell("B3").value = "ANDRE"
      aba.getCell("C3").value = "17/09/2026 05:51:27"
      aba.getCell("J3").value = 4
    })

    expect(await lerPrimeiraAba(dados)).toEqual([{ A: "Relatório" }, { A: 261, B: "ANDRE", C: "17/09/2026 05:51:27", J: 4 }])
  })

  it("data vira o número serial do Excel; fórmula vira o resultado; texto formatado vira texto", async () => {
    const dados = await planilha((aba) => {
      const data = aba.getCell("A1")
      data.value = new Date(Date.UTC(2026, 8, 17, 6, 0))
      data.numFmt = "dd/mm/yyyy hh:mm"
      aba.getCell("B1").value = { formula: "1+1", result: 2 }
      aba.getCell("C1").value = { richText: [{ text: "Join" }, { text: "ville" }] }
    })

    const [linha] = await lerPrimeiraAba(dados)
    expect(linha.A).toBeCloseTo(46282.25, 6) // 17/09/2026 06:00
    expect(linha.B).toBe(2)
    expect(linha.C).toBe("Joinville")
  })

  it("célula mesclada: só a primeira tem o valor", async () => {
    const dados = await planilha((aba) => {
      aba.getCell("A1").value = "Viagem"
      aba.mergeCells("A1:C1")
      aba.getCell("D1").value = "x"
    })

    expect(await lerPrimeiraAba(dados)).toEqual([{ A: "Viagem", D: "x" }])
  })
})

describe("validarArquivoPlanilha", () => {
  const arquivo = (nome: string, tipo = "", tamanho = 10) => new File([new Uint8Array(tamanho)], nome, { type: tipo })

  it("aceita .xlsx e explica o que fazer com .xls", () => {
    expect(() => validarArquivoPlanilha(arquivo("relatorio.xlsx"))).not.toThrow()
    expect(() => validarArquivoPlanilha(arquivo("relatorio.xls", "application/vnd.ms-excel"))).toThrow("salve como .xlsx")
    expect(() => validarArquivoPlanilha(arquivo("relatorio.csv"))).toThrow("Use arquivo .xlsx")
  })

  it("recusa arquivo acima de 10MB", () => {
    expect(() => validarArquivoPlanilha(arquivo("grande.xlsx", "", 11 * 1024 * 1024))).toThrow("Arquivo muito grande")
  })
})
