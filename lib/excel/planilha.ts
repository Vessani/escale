import ExcelJS from "exceljs"
import { formatarDataHoraPtBr } from "@/lib/utils/date-format"

/**
 * Planilhas do Escale com cara de relatório: faixa de título, linha de
 * contexto (período, filial, quando foi gerado), cabeçalho azul fixo com
 * filtro, linhas zebradas, destaque por linha (vermelho/amarelo), datas de
 * verdade (ordenam e filtram no Excel) e página pronta pra imprimir.
 * Substitui o `xlsx` (SheetJS), que na versão gratuita não grava estilo.
 */

export const CORES = {
  marinho: "FF0B3B74",
  azul: "FF0D5BAA",
  laranja: "FFF28C1B",
  texto: "FF1F2937",
  cinza: "FF6B7280",
  borda: "FFE5E7EB",
  zebra: "FFF6F8FB",
  secao: "FFE8EEF7",
  perigoFundo: "FFFDECEC",
  perigoTexto: "FFB42318",
  alertaFundo: "FFFFF4E0",
  alertaTexto: "FF9A5B00",
  sucessoTexto: "FF067647",
  apagado: "FF9CA3AF",
} as const

/** Brasil sem horário de verão desde 2019: o relógio de Brasília é sempre UTC-3. */
const OFFSET_BRASILIA_MS = 3 * 60 * 60 * 1000

/**
 * O Excel não tem fuso: guarda "dia e hora de parede". O exceljs grava a
 * data em UTC, então desloca pra que o número mostrado seja o de Brasília.
 */
export function paraHorarioDeParede(data: Date): Date {
  return new Date(data.getTime() - OFFSET_BRASILIA_MS)
}

export type TipoColuna = "texto" | "codigo" | "numero" | "decimal" | "data" | "dataHora" | "hora" | "percentual"
export type Valor = string | number | Date | null | undefined
export type Destaque = "perigo" | "alerta" | "apagado" | null

export type Coluna<T> = {
  titulo: string
  valor: (linha: T) => Valor
  tipo?: TipoColuna
  /** Largura em caracteres; sem ela, calcula pelo conteúdo. */
  largura?: number
  /** Soma a coluna numa linha de total no fim. */
  somar?: boolean
}

export type Aba<T> = {
  /** Nome da aba (até 31 caracteres). */
  nome: string
  titulo: string
  /** Linha de contexto abaixo do título (período, filtro...). */
  subtitulo?: string
  /** Números de destaque mostrados acima da tabela (ex: "Viagens: 12"). */
  resumo?: Array<{ rotulo: string; valor: string | number }>
  colunas: Coluna<T>[]
  linhas: T[]
  destaque?: (linha: T) => Destaque
  /** Linha de seção (faixa azul-clara) antes de cada grupo. */
  grupo?: (linha: T) => string
  vazio?: string
  /** Retrato pra documento de uma viagem; paisagem (padrão) pra listas. */
  orientacao?: "portrait" | "landscape"
}

export type Metadados = { filial?: string | null; geradoEm?: Date }

const FORMATO: Record<TipoColuna, string | undefined> = {
  texto: undefined,
  codigo: "@",
  numero: "#,##0",
  decimal: "#,##0.00",
  data: "dd/mm/yyyy",
  dataHora: "dd/mm/yyyy hh:mm",
  hora: "hh:mm",
  percentual: "0%",
}

const ALINHAMENTO: Record<TipoColuna, "left" | "center" | "right"> = {
  texto: "left",
  codigo: "left",
  numero: "right",
  decimal: "right",
  data: "center",
  dataHora: "center",
  hora: "center",
  percentual: "right",
}

function tamanhoExibido(valor: Valor, tipo: TipoColuna): number {
  if (valor === null || valor === undefined) return 0
  if (valor instanceof Date) return tipo === "data" ? 10 : tipo === "hora" ? 5 : 16
  return String(valor).length
}

function valorDaCelula(valor: Valor, tipo: TipoColuna): ExcelJS.CellValue {
  if (valor === null || valor === undefined || valor === "") return null
  if (valor instanceof Date) return paraHorarioDeParede(valor)
  if (tipo === "codigo") return String(valor)
  return valor
}

export const BORDA_FINA: Partial<ExcelJS.Borders> = {
  top: { style: "thin", color: { argb: CORES.borda } },
  bottom: { style: "thin", color: { argb: CORES.borda } },
  left: { style: "thin", color: { argb: CORES.borda } },
  right: { style: "thin", color: { argb: CORES.borda } },
}

export function preencher(cor: string): ExcelJS.Fill {
  return { type: "pattern", pattern: "solid", fgColor: { argb: cor } }
}

function nomeDeAba(nome: string, usados: Set<string>): string {
  const base = nome.replace(/[\\/?*[\]:]/g, "-").slice(0, 31) || "Planilha"
  let candidato = base
  for (let i = 2; usados.has(candidato); i++) candidato = `${base.slice(0, 28)} ${i}`
  usados.add(candidato)
  return candidato
}

function adicionarAba<T>(workbook: ExcelJS.Workbook, aba: Aba<T>, meta: Metadados, usados: Set<string>) {
  const total = Math.max(aba.colunas.length, 1)
  const planilha = workbook.addWorksheet(nomeDeAba(aba.nome, usados), {
    views: [{ showGridLines: false }],
    pageSetup: {
      orientation: aba.orientacao ?? "landscape",
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      paperSize: 9,
      margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 },
    },
    headerFooter: { oddFooter: "&L&8Escale&R&8Página &P de &N" },
  })

  // Faixa de título
  planilha.mergeCells(1, 1, 1, total)
  const titulo = planilha.getCell(1, 1)
  titulo.value = aba.titulo
  titulo.font = { name: "Calibri", size: 15, bold: true, color: { argb: "FFFFFFFF" } }
  titulo.fill = preencher(CORES.marinho)
  titulo.alignment = { vertical: "middle", indent: 1 }
  planilha.getRow(1).height = 30

  // Contexto
  const contexto = [
    aba.subtitulo,
    meta.filial ? `Filial ${meta.filial}` : null,
    `Gerado em ${formatarDataHoraPtBr(meta.geradoEm ?? new Date())}`,
  ]
    .filter(Boolean)
    .join("  ·  ")
  planilha.mergeCells(2, 1, 2, total)
  const linhaContexto = planilha.getCell(2, 1)
  linhaContexto.value = contexto
  linhaContexto.font = { size: 9, color: { argb: CORES.cinza } }
  linhaContexto.alignment = { vertical: "middle", indent: 1 }
  planilha.getRow(2).height = 18

  let linhaAtual = 3
  if (aba.resumo && aba.resumo.length > 0) {
    planilha.mergeCells(3, 1, 3, total)
    const resumo = planilha.getCell(3, 1)
    resumo.value = {
      richText: aba.resumo.flatMap((item, indice) => [
        ...(indice > 0 ? [{ text: "     " }] : []),
        { text: `${item.rotulo}: `, font: { size: 10, color: { argb: CORES.cinza } } },
        { text: String(item.valor), font: { size: 11, bold: true, color: { argb: CORES.azul } } },
      ]),
    }
    resumo.alignment = { vertical: "middle", indent: 1 }
    planilha.getRow(3).height = 22
    linhaAtual = 4
  }
  linhaAtual++ // respiro

  // Cabeçalho
  const linhaCabecalho = linhaAtual
  const cabecalho = planilha.getRow(linhaCabecalho)
  aba.colunas.forEach((coluna, indice) => {
    const celula = cabecalho.getCell(indice + 1)
    celula.value = coluna.titulo
    celula.font = { bold: true, size: 10, color: { argb: "FFFFFFFF" } }
    celula.fill = preencher(CORES.azul)
    celula.alignment = { vertical: "middle", horizontal: ALINHAMENTO[coluna.tipo ?? "texto"], wrapText: true }
    celula.border = BORDA_FINA
  })
  cabecalho.height = 24
  linhaAtual++

  const larguras = aba.colunas.map((coluna) => Math.max(coluna.titulo.length + 2, 8))

  if (aba.linhas.length === 0) {
    planilha.mergeCells(linhaAtual, 1, linhaAtual, total)
    const vazio = planilha.getCell(linhaAtual, 1)
    vazio.value = aba.vazio ?? "Nada no período."
    vazio.font = { italic: true, color: { argb: CORES.cinza } }
    vazio.alignment = { horizontal: "center", vertical: "middle" }
    planilha.getRow(linhaAtual).height = 24
    linhaAtual++
  }

  let grupoAtual: string | null = null
  let zebra = false
  for (const item of aba.linhas) {
    const grupo = aba.grupo?.(item) ?? null
    if (grupo !== null && grupo !== grupoAtual) {
      grupoAtual = grupo
      planilha.mergeCells(linhaAtual, 1, linhaAtual, total)
      const secao = planilha.getCell(linhaAtual, 1)
      secao.value = grupo
      secao.font = { bold: true, size: 10, color: { argb: CORES.marinho } }
      secao.fill = preencher(CORES.secao)
      secao.alignment = { vertical: "middle", indent: 1 }
      planilha.getRow(linhaAtual).height = 20
      linhaAtual++
      zebra = false
    }

    const destaque = aba.destaque?.(item) ?? null
    const linha = planilha.getRow(linhaAtual)
    aba.colunas.forEach((coluna, indice) => {
      const tipo = coluna.tipo ?? "texto"
      const valor = coluna.valor(item)
      const celula = linha.getCell(indice + 1)
      celula.value = valorDaCelula(valor, tipo)
      const formato = FORMATO[tipo]
      if (formato) celula.numFmt = formato
      celula.alignment = { vertical: "middle", horizontal: ALINHAMENTO[tipo], wrapText: tipo === "texto" }
      celula.border = BORDA_FINA
      celula.font = {
        size: 10,
        color: {
          argb:
            destaque === "perigo" ? CORES.perigoTexto : destaque === "alerta" ? CORES.alertaTexto : destaque === "apagado" ? CORES.apagado : CORES.texto,
        },
        strike: false,
      }
      const fundo = destaque === "perigo" ? CORES.perigoFundo : destaque === "alerta" ? CORES.alertaFundo : zebra ? CORES.zebra : null
      if (fundo) celula.fill = preencher(fundo)
      larguras[indice] = Math.max(larguras[indice], tamanhoExibido(valor, tipo) + 2)
    })
    // Sem altura fixa: o Excel ajusta quando o texto quebra (rota, clientes).
    zebra = !zebra
    linhaAtual++
  }

  // Totais
  if (aba.linhas.length > 0 && aba.colunas.some((coluna) => coluna.somar)) {
    const linha = planilha.getRow(linhaAtual)
    aba.colunas.forEach((coluna, indice) => {
      const celula = linha.getCell(indice + 1)
      if (indice === 0) celula.value = "Total"
      if (coluna.somar) {
        const soma = aba.linhas.reduce((acumulado, item) => {
          const valor = coluna.valor(item)
          return acumulado + (typeof valor === "number" ? valor : 0)
        }, 0)
        celula.value = soma
        const formato = FORMATO[coluna.tipo ?? "numero"]
        if (formato) celula.numFmt = formato
        celula.alignment = { horizontal: "right" }
      }
      celula.font = { bold: true, size: 10, color: { argb: CORES.marinho } }
      celula.fill = preencher(CORES.secao)
      celula.border = { ...BORDA_FINA, top: { style: "medium", color: { argb: CORES.azul } } }
    })
    linha.height = 20
  }

  aba.colunas.forEach((coluna, indice) => {
    planilha.getColumn(indice + 1).width = coluna.largura ?? Math.min(Math.max(larguras[indice], 8), 48)
  })

  planilha.views = [{ state: "frozen", ySplit: linhaCabecalho, showGridLines: false }]
  if (aba.linhas.length > 0 && aba.colunas.length > 0) {
    planilha.autoFilter = { from: { row: linhaCabecalho, column: 1 }, to: { row: linhaCabecalho, column: aba.colunas.length } }
  }
  planilha.pageSetup.printTitlesRow = `${linhaCabecalho}:${linhaCabecalho}`
}

/** Gera o .xlsx com uma aba por item, no estilo do Escale. */
// Cada aba tem seu próprio tipo de linha — `any` aqui só junta abas diferentes num array.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function gerarExcel(abas: Array<Aba<any>>, meta: Metadados = {}): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = "Escale"
  workbook.created = meta.geradoEm ?? new Date()
  const usados = new Set<string>()
  for (const aba of abas) adicionarAba(workbook, aba as Aba<unknown>, meta, usados)
  return Buffer.from(await workbook.xlsx.writeBuffer())
}

/** Ajuda a tipar uma aba sem perder o tipo da linha no array de abas. */
export function aba<T>(definicao: Aba<T>): Aba<T> {
  return definicao
}
