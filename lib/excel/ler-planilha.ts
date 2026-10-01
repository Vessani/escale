import * as XLSX from "xlsx"

/**
 * Lê uma aba gerada por lib/excel/planilha.ts como lista de objetos
 * (cabeçalho → valor), pulando a faixa de título, contexto e resumo — o
 * cabeçalho é a primeira linha com duas ou mais células preenchidas. Usado
 * nos testes.
 */
export function lerAba(buffer: Buffer, nomeAba: string): Record<string, unknown>[] {
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true })
  const planilha = workbook.Sheets[nomeAba]
  if (!planilha) throw new Error(`Aba "${nomeAba}" não existe (abas: ${workbook.SheetNames.join(", ")})`)
  const linhas = XLSX.utils.sheet_to_json<unknown[]>(planilha, { header: 1, blankrows: false, defval: null })
  const indiceCabecalho = linhas.findIndex((linha) => linha.filter((valor) => valor !== null && valor !== "").length >= 2)
  if (indiceCabecalho < 0) return []
  const cabecalho = linhas[indiceCabecalho].map((valor) => String(valor ?? ""))
  return linhas
    .slice(indiceCabecalho + 1)
    .filter((linha) => linha.filter((valor) => valor !== null && valor !== "").length >= 2)
    .map((linha) => Object.fromEntries(cabecalho.map((titulo, indice) => [titulo, linha[indice] ?? null])))
}

export function nomesDasAbas(buffer: Buffer): string[] {
  return XLSX.read(buffer, { type: "buffer" }).SheetNames
}

/** Todo o texto da aba (pra conferir documento sem tabela, como a ordem de viagem). */
export function textoDaAba(buffer: Buffer, nomeAba: string): string {
  const workbook = XLSX.read(buffer, { type: "buffer" })
  return XLSX.utils
    .sheet_to_json<unknown[]>(workbook.Sheets[nomeAba], { header: 1, blankrows: false, defval: "" })
    .map((linha) => linha.join(" | "))
    .join("\n")
}
