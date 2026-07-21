import * as XLSX from "xlsx"
import { inicioDoDia, parseDataHoraBr } from "@/lib/utils/date-format"

/**
 * Um registro por matrícula: o mais recente ("último dia de trabalho") entre
 * as várias jornadas que o relatório lista pra cada motorista.
 *
 * Datas como string (não Date) — Server Actions não serializam Date objects
 * como argumento vindo do cliente (mesma restrição documentada em xlsx-parser.ts).
 */
export type RegistroJornadaRelatorio = {
  matricula: number
  /** Só pra exibição na prévia de revisão — o cruzamento com o cadastro usa a matrícula, não o nome. */
  nome: string
  inicioJornada: string
  fimJornada: string
  dia: string
  /** Coluna "Dias Sem Folga" do relatório — vira o código de jornada do motorista (capado em 6, ver jornada-relatorio.service.ts). */
  diasSemFolga: number
}

type LinhaRelatorio = Record<string, unknown>

/** Linha 3 da planilha (0-indexed = 2): "Matrícula | Motorista | Início de Jornada | ... | Fim de Jornada | ..." */
const LINHA_CABECALHO = 2

/**
 * Extrator de dados brutos do relatório
 * Responsabilidade única: ler o XLSX e ficar só com o registro mais recente de cada matrícula
 */
class JornadaRelatorioExtractor {
  static extract(jsonData: LinhaRelatorio[]): RegistroJornadaRelatorio[] {
    const porMatricula = new Map<number, RegistroJornadaRelatorio>()

    for (let i = LINHA_CABECALHO + 1; i < jsonData.length; i++) {
      const registro = this.extrairLinha(jsonData[i])
      if (!registro) continue

      const atual = porMatricula.get(registro.matricula)
      if (!atual || new Date(registro.inicioJornada) > new Date(atual.inicioJornada)) {
        porMatricula.set(registro.matricula, registro)
      }
    }

    if (porMatricula.size === 0) {
      throw new Error("Nenhum registro de jornada encontrado no relatório. Verifique se a coluna A contém a matrícula.")
    }

    return [...porMatricula.values()]
  }

  /** Linhas malformadas (data inválida, matrícula ausente) são ignoradas, não derrubam o import inteiro. */
  private static extrairLinha(linha: LinhaRelatorio): RegistroJornadaRelatorio | null {
    const matriculaTexto = this.obterValor(linha["A"])
    if (!matriculaTexto || !/^\d+$/.test(matriculaTexto)) {
      return null
    }

    const inicioTexto = this.obterValor(linha["C"])
    const fimTexto = this.obterValor(linha["F"])
    if (!inicioTexto || !fimTexto) {
      return null
    }

    const diasSemFolgaTexto = this.obterValor(linha["J"])
    if (!diasSemFolgaTexto || !/^\d+$/.test(diasSemFolgaTexto)) {
      return null
    }

    try {
      const inicioJornada = parseDataHoraBr(inicioTexto)
      const fimJornada = parseDataHoraBr(fimTexto)

      return {
        matricula: Number(matriculaTexto),
        nome: this.obterValor(linha["B"]),
        inicioJornada: inicioJornada.toISOString(),
        fimJornada: fimJornada.toISOString(),
        dia: inicioDoDia(inicioJornada).toISOString(),
        diasSemFolga: Number(diasSemFolgaTexto),
      }
    } catch {
      return null
    }
  }

  private static obterValor(valor: unknown): string {
    return valor ? String(valor).trim() : ""
  }
}

/**
 * Leitor de arquivo XLSX
 * Responsabilidade única: ler arquivo binário e converter para JSON
 */
class JornadaRelatorioFileReader {
  static readFile(file: File): Promise<LinhaRelatorio[]> {
    return new Promise((resolve, reject) => {
      this.validateFile(file)

      const reader = new FileReader()

      reader.onload = (event) => {
        try {
          const data = new Uint8Array(event.target?.result as ArrayBuffer)
          const workbook = XLSX.read(data, { type: "array" })
          const sheetName = workbook.SheetNames[0]

          if (!sheetName) {
            reject(new Error("Planilha vazia ou inválida"))
            return
          }

          const worksheet = workbook.Sheets[sheetName]
          const jsonData = XLSX.utils.sheet_to_json<LinhaRelatorio>(worksheet, { header: "A" })

          resolve(jsonData)
        } catch (error) {
          reject(
            new Error(`Erro ao processar arquivo XLSX: ${error instanceof Error ? error.message : "Erro desconhecido"}`),
          )
        }
      }

      reader.onerror = () => {
        reject(new Error("Erro ao ler arquivo. Verifique se o arquivo não está corrompido."))
      }

      reader.readAsArrayBuffer(file)
    })
  }

  private static validateFile(file: File): void {
    if (!file) {
      throw new Error("Arquivo não fornecido")
    }

    const validMimeTypes = [
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-excel",
    ]
    const validExtensions = /\.(xlsx|xls)$/i

    if (file.type && !validMimeTypes.includes(file.type)) {
      throw new Error(`Tipo de arquivo inválido. Tipo detectado: ${file.type}`)
    }

    if (!validExtensions.test(file.name)) {
      throw new Error("Nome de arquivo inválido. Use arquivo .xlsx ou .xls")
    }

    const maxSizeBytes = 10 * 1024 * 1024
    if (file.size > maxSizeBytes) {
      throw new Error(`Arquivo muito grande. Máximo: 10MB, fornecido: ${(file.size / 1024 / 1024).toFixed(2)}MB`)
    }
  }
}

/**
 * Parser Principal - Orquestra os componentes
 */
export class JornadaRelatorioParser {
  static async parseFromFile(file: File): Promise<RegistroJornadaRelatorio[]> {
    const jsonData = await JornadaRelatorioFileReader.readFile(file)
    return JornadaRelatorioExtractor.extract(jsonData)
  }

  /** Extração pura, sem I/O — usada nos testes e reaproveitável fora do browser. */
  static extrairDeLinhas(jsonData: LinhaRelatorio[]): RegistroJornadaRelatorio[] {
    return JornadaRelatorioExtractor.extract(jsonData)
  }
}
