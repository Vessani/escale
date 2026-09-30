import * as XLSX from "xlsx"
import { inicioDoDia, parseDataHoraBr } from "@/lib/utils/date-format"

/**
 * Um registro por (matrícula, dia): o relatório lista vários turnos por
 * motorista, um por dia trabalhado, e todos são mantidos — só uma duplicata
 * de matrícula no MESMO dia colapsa (fica a de `Início de Jornada` mais
 * recente). Alimenta tanto o histórico do calendário quanto, pra cada
 * matrícula, o turno mais recente do lote (ver jornada-relatorio.service.ts).
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
  /**
   * "Dias Sem Folga" já corrigido — vira o código de jornada do motorista
   * (capado em 6, ver jornada-relatorio.service.ts). Difere de
   * `diasSemFolgaRelatorio` quando o relatório registrou entrada e saída em
   * linhas separadas (ver `corrigirDiasSemFolga`).
   */
  diasSemFolga: number
  /** Valor bruto da coluna J ("Dias Sem Folga") do relatório, antes da correção. */
  diasSemFolgaRelatorio: number
  correcao: CorrecaoJornada
}

/**
 * - `BATIDAS_UNIDAS`: entrada e saída vieram em duas linhas de ~1 minuto e
 *   foram juntadas numa jornada só.
 * - `BATIDA_SEM_PAR`: linha de ~1 minuto sem a batida par — conta como dia
 *   trabalhado, mas o fim pode não ser o real (jornada provavelmente em andamento).
 */
export type CorrecaoJornada = "BATIDAS_UNIDAS" | "BATIDA_SEM_PAR" | null

type LinhaRelatorio = Record<string, unknown>

/** Registro ainda com os instantes como Date, usados só durante a junção/correção. */
type JornadaExtraida = RegistroJornadaRelatorio & { inicio: Date; fim: Date }

/** Linha 3 da planilha (0-indexed = 2): "Matrícula | Motorista | Início de Jornada | ... | Fim de Jornada | ..." */
const LINHA_CABECALHO = 2

const MINUTO_MS = 60_000
const HORA_MS = 60 * MINUTO_MS

/** Linha mais curta que isso é uma batida isolada (entrada ou saída), não uma jornada. */
const DURACAO_MAXIMA_BATIDA_MS = 5 * MINUTO_MS
/** Distância máxima entre a batida de entrada e a de saída do mesmo turno. */
const INTERVALO_MAXIMO_ENTRE_BATIDAS_MS = 20 * HORA_MS
/** Descanso que caracteriza folga — mesmo valor de MINIMO_HORAS_ENTRE_FOLGAS (lib/services/alocacao/disponibilidade.ts), não importado de lá pra não puxar @prisma/client pro bundle do cliente. */
const DESCANSO_MINIMO_FOLGA_MS = 35 * HORA_MS

/**
 * Extrator de dados brutos do relatório
 * Responsabilidade única: ler o XLSX e ficar com um registro por (matrícula,
 * dia) — dias diferentes da mesma matrícula sobrevivem todos; só duplicata
 * no mesmo dia colapsa, ficando a de início mais recente.
 *
 * Antes disso, por matrícula, junta entrada/saída que o rastreamento
 * registrou como duas linhas de ~1 minuto (`juntarBatidas`) e desfaz o +1
 * indevido que cada linha extra somou em "Dias Sem Folga"
 * (`corrigirDiasSemFolga`).
 */
class JornadaRelatorioExtractor {
  static extract(jsonData: LinhaRelatorio[]): RegistroJornadaRelatorio[] {
    const porMatricula = new Map<number, JornadaExtraida[]>()

    for (let i = LINHA_CABECALHO + 1; i < jsonData.length; i++) {
      const linha = this.extrairLinha(jsonData[i])
      if (!linha) continue

      const grupo = porMatricula.get(linha.matricula)
      if (grupo) {
        grupo.push(linha)
      } else {
        porMatricula.set(linha.matricula, [linha])
      }
    }

    const porMatriculaEDia = new Map<string, RegistroJornadaRelatorio>()

    for (const grupo of porMatricula.values()) {
      grupo.sort((a, b) => a.inicio.getTime() - b.inicio.getTime())

      for (const registro of this.corrigirDiasSemFolga(this.juntarBatidas(grupo))) {
        const chave = `${registro.matricula}-${registro.dia}`
        const atual = porMatriculaEDia.get(chave)
        if (!atual || new Date(registro.inicioJornada) > new Date(atual.inicioJornada)) {
          porMatriculaEDia.set(chave, registro)
        }
      }
    }

    if (porMatriculaEDia.size === 0) {
      throw new Error("Nenhum registro de jornada encontrado no relatório. Verifique se a coluna A contém a matrícula.")
    }

    return [...porMatriculaEDia.values()]
  }

  /**
   * Linhas de uma matrícula, já ordenadas por início. Uma batida seguida de
   * outra batida a até INTERVALO_MAXIMO_ENTRE_BATIDAS_MS vira uma jornada só
   * (início da primeira, fim da segunda, "Dias Sem Folga" da primeira); batida
   * sem par segue sozinha, marcada.
   */
  private static juntarBatidas(linhas: JornadaExtraida[]): JornadaExtraida[] {
    const jornadas: JornadaExtraida[] = []

    for (let i = 0; i < linhas.length; i++) {
      const atual = linhas[i]
      if (!this.ehBatida(atual)) {
        jornadas.push(atual)
        continue
      }

      const proxima = linhas[i + 1]
      if (
        proxima &&
        this.ehBatida(proxima) &&
        proxima.inicio.getTime() - atual.fim.getTime() <= INTERVALO_MAXIMO_ENTRE_BATIDAS_MS
      ) {
        jornadas.push({
          ...atual,
          fim: proxima.fim,
          fimJornada: proxima.fimJornada,
          correcao: "BATIDAS_UNIDAS",
        })
        i++
        continue
      }

      jornadas.push({ ...atual, correcao: "BATIDA_SEM_PAR" })
    }

    return jornadas
  }

  /**
   * O relatório soma +1 em "Dias Sem Folga" a cada linha, então cada par de
   * batidas unidas deixou todas as linhas seguintes 1 dia adiantadas, até a
   * próxima folga. Folga = descanso de DESCANSO_MINIMO_FOLGA_MS ou mais desde
   * o fim da jornada anterior, ou o próprio relatório voltando pra 1.
   */
  private static corrigirDiasSemFolga(jornadas: JornadaExtraida[]): RegistroJornadaRelatorio[] {
    let inflacaoAcumulada = 0
    let fimAnterior: Date | null = null

    return jornadas.map((jornada) => {
      const houveFolga =
        jornada.diasSemFolgaRelatorio === 1 ||
        (fimAnterior !== null && jornada.inicio.getTime() - fimAnterior.getTime() >= DESCANSO_MINIMO_FOLGA_MS)
      if (houveFolga) {
        inflacaoAcumulada = 0
      }

      const diasSemFolga = Math.max(1, jornada.diasSemFolgaRelatorio - inflacaoAcumulada)

      if (jornada.correcao === "BATIDAS_UNIDAS") {
        inflacaoAcumulada++
      }
      fimAnterior = jornada.fim

      return {
        matricula: jornada.matricula,
        nome: jornada.nome,
        inicioJornada: jornada.inicioJornada,
        fimJornada: jornada.fimJornada,
        dia: jornada.dia,
        diasSemFolga,
        diasSemFolgaRelatorio: jornada.diasSemFolgaRelatorio,
        correcao: jornada.correcao,
      }
    })
  }

  private static ehBatida(linha: JornadaExtraida): boolean {
    return linha.fim.getTime() - linha.inicio.getTime() < DURACAO_MAXIMA_BATIDA_MS
  }

  /** Linhas malformadas (data inválida, matrícula ausente) são ignoradas, não derrubam o import inteiro. */
  private static extrairLinha(linha: LinhaRelatorio): JornadaExtraida | null {
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

      const diasSemFolgaRelatorio = Number(diasSemFolgaTexto)

      return {
        matricula: Number(matriculaTexto),
        nome: this.obterValor(linha["B"]),
        inicioJornada: inicioJornada.toISOString(),
        fimJornada: fimJornada.toISOString(),
        dia: inicioDoDia(inicioJornada).toISOString(),
        diasSemFolga: diasSemFolgaRelatorio,
        diasSemFolgaRelatorio,
        correcao: null,
        inicio: inicioJornada,
        fim: fimJornada,
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
