import type { CellValue, Worksheet } from "exceljs"

/** Linha da planilha indexada pela letra da coluna ({ A: ..., B: ... }) — o formato que os parsers de importação esperam. */
type LinhaPorColuna = Record<string, unknown>

const TAMANHO_MAXIMO_BYTES = 10 * 1024 * 1024
const MS_POR_DIA = 86_400_000
/** 30/12/1899 (UTC) — o "dia zero" das datas do Excel. */
const EPOCA_EXCEL_MS = Date.UTC(1899, 11, 30)

function letraDaColuna(numero: number): string {
  let letra = ""
  for (let n = numero; n > 0; n = Math.floor((n - 1) / 26)) letra = String.fromCharCode(65 + ((n - 1) % 26)) + letra
  return letra
}

/**
 * Valor "cru" da célula, igual ao que a leitura anterior (SheetJS,
 * sheet_to_json) entregava: número, texto ou booleano; data vira o número
 * serial do Excel (os parsers já sabem converter); fórmula vira o
 * resultado; texto formatado vira o texto. Vazio/erro = undefined.
 */
function valorCru(valor: CellValue): unknown {
  if (valor === null || valor === undefined) return undefined
  if (valor instanceof Date) return (valor.getTime() - EPOCA_EXCEL_MS) / MS_POR_DIA
  if (typeof valor !== "object") return valor
  if ("result" in valor) return valorCru(valor.result as CellValue)
  if ("richText" in valor) return valor.richText.map((trecho) => trecho.text).join("")
  if ("text" in valor) return valorCru(valor.text as CellValue)
  return undefined
}

/**
 * Linhas não vazias da aba, cada uma como { A: valor, B: valor, ... } —
 * equivalente ao sheet_to_json(aba, { header: "A" }) usado antes. Em célula
 * mesclada só a primeira (a de cima à esquerda) tem o valor, como antes.
 */
function linhasPorColuna(aba: Worksheet): LinhaPorColuna[] {
  const linhas: LinhaPorColuna[] = []
  aba.eachRow({ includeEmpty: false }, (linha) => {
    const valores: LinhaPorColuna = {}
    linha.eachCell({ includeEmpty: false }, (celula, coluna) => {
      if (celula.isMerged && celula.master.address !== celula.address) return
      const valor = valorCru(celula.value)
      if (valor !== undefined) valores[letraDaColuna(coluna)] = valor
    })
    if (Object.keys(valores).length > 0) linhas.push(valores)
  })
  return linhas
}

/** Primeira aba de um .xlsx já em memória (navegador ou servidor). */
export async function lerPrimeiraAba(dados: ArrayBuffer): Promise<LinhaPorColuna[]> {
  // Carregado só quando alguém escolhe um arquivo — não pesa na abertura das telas.
  const ExcelJS = (await import("exceljs")).default
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(dados)
  const aba = workbook.worksheets[0]
  if (!aba) throw new Error("Planilha vazia ou inválida")
  return linhasPorColuna(aba)
}

/** Confere tipo, extensão e tamanho antes de ler. Só .xlsx — o .xls antigo pede pra salvar de novo. */
export function validarArquivoPlanilha(arquivo: File | null | undefined): asserts arquivo is File {
  if (!arquivo) throw new Error("Arquivo não fornecido")
  if (/\.xls$/i.test(arquivo.name)) {
    throw new Error("Arquivo .xls (Excel antigo) não é aceito. Abra no Excel e salve como .xlsx.")
  }
  if (!/\.xlsx$/i.test(arquivo.name)) throw new Error("Nome de arquivo inválido. Use arquivo .xlsx")
  const tipos = ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "application/octet-stream"]
  if (arquivo.type && !tipos.includes(arquivo.type)) throw new Error(`Tipo de arquivo inválido. Tipo detectado: ${arquivo.type}`)
  if (arquivo.size > TAMANHO_MAXIMO_BYTES) {
    throw new Error(`Arquivo muito grande. Máximo: 10MB, fornecido: ${(arquivo.size / 1024 / 1024).toFixed(2)}MB`)
  }
}

/** Valida e lê a primeira aba do arquivo escolhido pela pessoa. */
export async function lerPlanilhaDoArquivo(arquivo: File): Promise<LinhaPorColuna[]> {
  validarArquivoPlanilha(arquivo)
  try {
    return await lerPrimeiraAba(await arquivo.arrayBuffer())
  } catch (erro) {
    throw new Error(`Erro ao processar arquivo XLSX: ${erro instanceof Error ? erro.message : "Erro desconhecido"}`)
  }
}
