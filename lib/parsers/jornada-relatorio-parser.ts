import * as XLSX from "xlsx"
import { inicioDoDia, parseDataHoraBr } from "@/lib/utils/date-format"

/**
 * Um registro por (matrícula, dia) pronto pra importar: o relatório lista
 * vários turnos por motorista, um por dia trabalhado. Alimenta tanto o
 * histórico do calendário quanto, pra cada matrícula, o turno mais recente
 * do lote (ver jornada-relatorio.service.ts).
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
   * `diasSemFolgaRelatorio` quando alguma linha do relatório não era um dia
   * de trabalho de verdade (ver `corrigirDiasSemFolga`) ou quando foi
   * ajustado à mão na conferência.
   */
  diasSemFolga: number
  /** Valor bruto da coluna J ("Dias Sem Folga") do relatório, antes da correção. */
  diasSemFolgaRelatorio: number
  correcao: CorrecaoJornada
}

/**
 * - `BATIDAS_UNIDAS`: entrada e saída vieram em duas linhas curtas e foram
 *   juntadas numa jornada só.
 * - `BATIDA_EXTRA`: uma batida solta logo depois do fim da jornada (menos de
 *   11h, sem par) foi desconsiderada — o relatório contou ela como mais um dia.
 * - `BATIDA_SEM_PAR`: linha de ~1 minuto sem a batida par — conta como dia
 *   trabalhado, mas o fim pode não ser o real (jornada provavelmente em andamento).
 */
export type CorrecaoJornada = "BATIDAS_UNIDAS" | "BATIDA_EXTRA" | "BATIDA_SEM_PAR" | null

/** Uma linha do arquivo, como veio (só lida e validada). `id` = posição no arquivo, estável entre edições. */
export type LinhaJornadaBruta = {
  id: number
  matricula: number
  nome: string
  inicio: string
  fim: string
  diasSemFolgaRelatorio: number
}

/**
 * O que a pessoa ajustou na conferência, por id de linha do arquivo:
 * - `ignoradas`: linha que não era jornada (batida errada) — sai da contagem;
 * - `horarios`: início/fim corrigidos;
 * - `dias`: "dias sem folga" corrigido à mão (as linhas seguintes do mesmo
 *   motorista se ajustam até a próxima folga);
 * - `semCorrecao`: desfaz a correção automática (junção/batida extra) daquela linha.
 */
export type EdicoesJornada = {
  ignoradas: number[]
  horarios: Record<number, { inicio: string; fim: string }>
  dias: Record<number, number>
  semCorrecao: number[]
}

export const SEM_EDICOES: EdicoesJornada = { ignoradas: [], horarios: {}, dias: {}, semCorrecao: [] }

/**
 * - `IMPORTAR`: entra no calendário;
 * - `MESMO_DIA`: já tem outra jornada (mais tarde) no mesmo dia — o
 *   calendário guarda uma por dia, então esta não entra;
 * - `IGNORADA`: a pessoa marcou pra ignorar;
 * - `ABSORVIDA`: batida extra desconsiderada (junto da jornada anterior).
 */
export type SituacaoLinhaJornada = "IMPORTAR" | "MESMO_DIA" | "IGNORADA" | "ABSORVIDA"

/** Uma linha da tela de conferência. */
export type LinhaRevisaoJornada = RegistroJornadaRelatorio & {
  /** Id da linha do arquivo que manda nesta (a primeira, se foram juntadas). */
  id: number
  /** Ids de todas as linhas do arquivo que viraram esta. */
  ids: number[]
  situacao: SituacaoLinhaJornada
  /** Batida desconsiderada junto desta jornada (ex: "15:32"), pra mostrar na tela. */
  batidaExtra: string | null
  /** Valores como vieram do arquivo, pra mostrar o "era" de uma linha editada. */
  original: { inicio: string; fim: string }
  editada: boolean
}

type LinhaRelatorio = Record<string, unknown>

/** Linha 3 da planilha (0-indexed = 2): "Matrícula | Motorista | Início de Jornada | ... | Fim de Jornada | ..." */
const LINHA_CABECALHO = 2

const MINUTO_MS = 60_000
const HORA_MS = 60 * MINUTO_MS

/** Linha mais curta que isso é uma batida isolada (entrada ou saída), não uma jornada. */
const DURACAO_MAXIMA_BATIDA_MS = 5 * MINUTO_MS
/** Uma batida de entrada pode ter como par uma linha curta (saída registrada com alguns minutos), não só outra batida. */
const DURACAO_MAXIMA_PAR_DA_BATIDA_MS = 60 * MINUTO_MS
/** Distância máxima entre a batida de entrada e a de saída do mesmo turno. */
const INTERVALO_MAXIMO_ENTRE_BATIDAS_MS = 20 * HORA_MS
/** Batida solta a menos disso do fim da jornada anterior não é uma jornada nova (seria quebra de interstício) — é batida a mais. Mesmo valor de MINIMO_HORAS_ENTRE_JORNADAS. */
const INTERVALO_MAXIMO_BATIDA_EXTRA_MS = 11 * HORA_MS
/** Descanso que caracteriza folga — mesmo valor de MINIMO_HORAS_ENTRE_FOLGAS (lib/services/alocacao/disponibilidade.ts), não importado de lá pra não puxar @prisma/client pro bundle do cliente. */
const DESCANSO_MINIMO_FOLGA_MS = 35 * HORA_MS

type LinhaEmTrabalho = LinhaJornadaBruta & { inicioMs: number; fimMs: number; editada: boolean; original: { inicio: string; fim: string } }

/** Jornada já montada (uma ou duas linhas do arquivo), antes de corrigir os dias. */
type JornadaMontada = {
  linhas: LinhaEmTrabalho[]
  inicioMs: number
  fimMs: number
  correcao: CorrecaoJornada
  batidaExtra: LinhaEmTrabalho | null
}

/** Item da sequência de um motorista: jornada, ou linha que não conta como dia (ignorada / batida extra). */
type ItemSequencia = { tipo: "JORNADA"; jornada: JornadaMontada } | { tipo: "FORA"; linha: LinhaEmTrabalho; situacao: "IGNORADA" }

const duracao = (linha: { inicioMs: number; fimMs: number }) => linha.fimMs - linha.inicioMs

function horaLocal(ms: number) {
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" }).format(ms)
}

/**
 * Leitura do arquivo: uma linha bruta por linha válida, sem juntar nem
 * corrigir nada. Linhas malformadas (data inválida, matrícula ausente) são
 * ignoradas, não derrubam o import inteiro.
 */
class JornadaRelatorioExtractor {
  static extrairLinhas(jsonData: LinhaRelatorio[]): LinhaJornadaBruta[] {
    const linhas: LinhaJornadaBruta[] = []
    for (let i = LINHA_CABECALHO + 1; i < jsonData.length; i++) {
      const linha = this.extrairLinha(jsonData[i], i)
      if (linha) linhas.push(linha)
    }
    if (linhas.length === 0) {
      throw new Error("Nenhum registro de jornada encontrado no relatório. Verifique se a coluna A contém a matrícula.")
    }
    return linhas
  }

  private static extrairLinha(linha: LinhaRelatorio, id: number): LinhaJornadaBruta | null {
    const matriculaTexto = this.obterValor(linha["A"]).replace(/\.0+$/, "")
    if (!matriculaTexto || !/^\d+$/.test(matriculaTexto)) return null

    const inicioTexto = this.obterValor(linha["C"])
    const fimTexto = this.obterValor(linha["F"])
    if (!inicioTexto || !fimTexto) return null

    const diasSemFolgaTexto = this.obterValor(linha["J"]).replace(/\.0+$/, "")
    if (!diasSemFolgaTexto || !/^\d+$/.test(diasSemFolgaTexto)) return null

    try {
      return {
        id,
        matricula: Number(matriculaTexto),
        nome: this.obterValor(linha["B"]),
        inicio: parseDataHoraBr(inicioTexto).toISOString(),
        fim: parseDataHoraBr(fimTexto).toISOString(),
        diasSemFolgaRelatorio: Number(diasSemFolgaTexto),
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
 * Processamento: aplica as edições da conferência e, por matrícula (linhas em
 * ordem de início):
 * 1. junta entrada e saída que vieram em linhas separadas (`juntarBatidas`)
 *    e desconsidera batida solta logo depois de uma jornada;
 * 2. desfaz o +1 indevido que cada linha que não era um dia de verdade somou
 *    em "Dias Sem Folga" (`corrigirDiasSemFolga`), e aplica o ajuste manual;
 * 3. no mesmo dia, a jornada de início mais recente vai pro calendário (que
 *    guarda uma por dia); as outras continuam na tela, marcadas.
 */
class JornadaRelatorioProcessador {
  static processar(brutas: LinhaJornadaBruta[], edicoes: EdicoesJornada): LinhaRevisaoJornada[] {
    const ignoradas = new Set(edicoes.ignoradas)
    const semCorrecao = new Set(edicoes.semCorrecao)

    const porMatricula = new Map<number, LinhaEmTrabalho[]>()
    for (const bruta of brutas) {
      const horario = edicoes.horarios[bruta.id]
      const inicio = horario?.inicio ?? bruta.inicio
      const fim = horario?.fim ?? bruta.fim
      const linha: LinhaEmTrabalho = {
        ...bruta,
        inicio,
        fim,
        inicioMs: new Date(inicio).getTime(),
        fimMs: new Date(fim).getTime(),
        // Desfazer a correção automática também é um ajuste de quem conferiu.
        editada: horario !== undefined || semCorrecao.has(bruta.id),
        original: { inicio: bruta.inicio, fim: bruta.fim },
      }
      const lista = porMatricula.get(bruta.matricula) ?? []
      lista.push(linha)
      porMatricula.set(bruta.matricula, lista)
    }

    const resultado: LinhaRevisaoJornada[] = []
    for (const linhas of porMatricula.values()) {
      linhas.sort((a, b) => a.inicioMs - b.inicioMs || a.id - b.id)
      const sequencia = this.juntarBatidas(linhas, ignoradas, semCorrecao)
      resultado.push(...this.marcarMesmoDia(this.corrigirDiasSemFolga(sequencia, edicoes.dias)))
    }
    return resultado
  }

  /**
   * Linhas de uma matrícula, já ordenadas por início:
   * - batida seguida de batida (ou de linha curta, a saída) a até
   *   INTERVALO_MAXIMO_ENTRE_BATIDAS_MS → uma jornada só (início da
   *   primeira, fim da segunda, "Dias Sem Folga" da primeira);
   * - batida solta a menos de 11h do fim da jornada anterior → batida
   *   extra, desconsiderada (fica junto da jornada anterior);
   * - outra batida solta segue sozinha, marcada como sem par.
   * Linha em `semCorrecao` é tratada como jornada normal.
   */
  private static juntarBatidas(linhas: LinhaEmTrabalho[], ignoradas: Set<number>, semCorrecao: Set<number>): ItemSequencia[] {
    const sequencia: ItemSequencia[] = []
    const ehBatida = (linha: LinhaEmTrabalho) => !semCorrecao.has(linha.id) && duracao(linha) < DURACAO_MAXIMA_BATIDA_MS
    let anterior: JornadaMontada | null = null

    for (let i = 0; i < linhas.length; i++) {
      const atual = linhas[i]
      if (ignoradas.has(atual.id)) {
        sequencia.push({ tipo: "FORA", linha: atual, situacao: "IGNORADA" })
        continue
      }

      const jornada: JornadaMontada = { linhas: [atual], inicioMs: atual.inicioMs, fimMs: atual.fimMs, correcao: null, batidaExtra: null }

      if (ehBatida(atual)) {
        let j = i + 1
        while (j < linhas.length && ignoradas.has(linhas[j].id)) j++
        const proxima = linhas[j]
        const proximaEhPar =
          proxima &&
          !semCorrecao.has(proxima.id) &&
          duracao(proxima) < DURACAO_MAXIMA_PAR_DA_BATIDA_MS &&
          proxima.inicioMs - atual.fimMs <= INTERVALO_MAXIMO_ENTRE_BATIDAS_MS

        if (proximaEhPar) {
          // Ignoradas no meio do caminho entram na sequência antes da junção.
          for (let k = i + 1; k < j; k++) sequencia.push({ tipo: "FORA", linha: linhas[k], situacao: "IGNORADA" })
          jornada.linhas.push(proxima)
          jornada.fimMs = proxima.fimMs
          jornada.correcao = "BATIDAS_UNIDAS"
          i = j
        } else if (
          anterior &&
          anterior.correcao !== "BATIDA_SEM_PAR" &&
          anterior.batidaExtra === null &&
          atual.inicioMs >= anterior.fimMs &&
          atual.inicioMs - anterior.fimMs < INTERVALO_MAXIMO_BATIDA_EXTRA_MS
        ) {
          anterior.batidaExtra = atual
          continue
        } else {
          jornada.correcao = "BATIDA_SEM_PAR"
        }
      }

      sequencia.push({ tipo: "JORNADA", jornada })
      anterior = jornada
    }

    return sequencia
  }

  /**
   * O relatório soma +1 em "Dias Sem Folga" a cada linha. Cada linha que não
   * era um dia de verdade (a segunda de um par de batidas, a batida extra, a
   * linha ignorada) deixou as seguintes 1 dia adiantadas, até a próxima
   * folga. Folga = descanso de DESCANSO_MINIMO_FOLGA_MS ou mais desde o fim
   * da jornada anterior, ou o próprio relatório voltando pra 1. O ajuste
   * manual de uma linha passa a valer pra ela e desloca as seguintes do
   * mesmo jeito.
   */
  private static corrigirDiasSemFolga(sequencia: ItemSequencia[], ajustes: Record<number, number>): LinhaRevisaoJornada[] {
    let inflacao = 0
    let fimAnterior: number | null = null
    const linhas: LinhaRevisaoJornada[] = []

    for (const item of sequencia) {
      if (item.tipo === "FORA") {
        inflacao++
        linhas.push(this.linhaFora(item.linha, item.situacao))
        continue
      }

      const { jornada } = item
      const primeira = jornada.linhas[0]
      const ultima = jornada.linhas[jornada.linhas.length - 1]
      const houveFolga =
        primeira.diasSemFolgaRelatorio === 1 || (fimAnterior !== null && jornada.inicioMs - fimAnterior >= DESCANSO_MINIMO_FOLGA_MS)
      // Depois de uma folga a contagem recomeça em 1 — mesmo que o relatório
      // não tenha visto essa folga (ex: as linhas no meio foram ignoradas).
      if (houveFolga) inflacao = primeira.diasSemFolgaRelatorio - 1

      const ajuste = ajustes[primeira.id]
      let diasSemFolga = Math.max(1, primeira.diasSemFolgaRelatorio - inflacao)
      if (ajuste !== undefined && Number.isInteger(ajuste) && ajuste >= 1) {
        diasSemFolga = ajuste
        inflacao = primeira.diasSemFolgaRelatorio - ajuste
      }

      // A segunda linha de um par de batidas e a batida extra também tinham somado +1.
      inflacao += jornada.linhas.length - 1
      if (jornada.batidaExtra) inflacao++
      fimAnterior = jornada.fimMs

      linhas.push({
        id: primeira.id,
        ids: jornada.linhas.map((linha) => linha.id),
        matricula: primeira.matricula,
        nome: primeira.nome,
        inicioJornada: primeira.inicio,
        fimJornada: ultima.fim,
        dia: inicioDoDia(new Date(primeira.inicio)).toISOString(),
        diasSemFolga,
        diasSemFolgaRelatorio: primeira.diasSemFolgaRelatorio,
        correcao: jornada.batidaExtra ? "BATIDA_EXTRA" : jornada.correcao,
        situacao: "IMPORTAR",
        batidaExtra: jornada.batidaExtra ? horaLocal(jornada.batidaExtra.inicioMs) : null,
        original: { inicio: primeira.original.inicio, fim: ultima.original.fim },
        editada: jornada.linhas.some((linha) => linha.editada) || ajuste !== undefined,
      })
      if (jornada.batidaExtra) linhas.push(this.linhaFora(jornada.batidaExtra, "ABSORVIDA"))
    }

    return linhas
  }

  private static linhaFora(linha: LinhaEmTrabalho, situacao: "IGNORADA" | "ABSORVIDA"): LinhaRevisaoJornada {
    return {
      id: linha.id,
      ids: [linha.id],
      matricula: linha.matricula,
      nome: linha.nome,
      inicioJornada: linha.inicio,
      fimJornada: linha.fim,
      dia: inicioDoDia(new Date(linha.inicio)).toISOString(),
      diasSemFolga: linha.diasSemFolgaRelatorio,
      diasSemFolgaRelatorio: linha.diasSemFolgaRelatorio,
      correcao: null,
      situacao,
      batidaExtra: null,
      original: linha.original,
      editada: linha.editada,
    }
  }

  /** O calendário guarda uma jornada por dia: fica a de início mais recente, as outras ficam visíveis como MESMO_DIA. */
  private static marcarMesmoDia(linhas: LinhaRevisaoJornada[]): LinhaRevisaoJornada[] {
    const ultimaDoDia = new Map<string, LinhaRevisaoJornada>()
    for (const linha of linhas) {
      if (linha.situacao !== "IMPORTAR") continue
      const atual = ultimaDoDia.get(linha.dia)
      if (!atual || new Date(linha.inicioJornada) > new Date(atual.inicioJornada)) ultimaDoDia.set(linha.dia, linha)
    }
    return linhas.map((linha) =>
      linha.situacao === "IMPORTAR" && ultimaDoDia.get(linha.dia) !== linha ? { ...linha, situacao: "MESMO_DIA" } : linha,
    )
  }
}

/** Só as linhas que vão pro calendário, no formato que a importação recebe. */
export function registrosParaImportar(linhas: LinhaRevisaoJornada[]): RegistroJornadaRelatorio[] {
  return linhas
    .filter((linha) => linha.situacao === "IMPORTAR")
    .map((linha) => ({
      matricula: linha.matricula,
      nome: linha.nome,
      inicioJornada: linha.inicioJornada,
      fimJornada: linha.fimJornada,
      dia: linha.dia,
      diasSemFolga: linha.diasSemFolga,
      diasSemFolgaRelatorio: linha.diasSemFolgaRelatorio,
      correcao: linha.correcao,
    }))
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
  /** Lê o arquivo e devolve as linhas como vieram — a tela de conferência processa (e reprocessa a cada edição) com `processar`. */
  static async lerArquivo(file: File): Promise<LinhaJornadaBruta[]> {
    const jsonData = await JornadaRelatorioFileReader.readFile(file)
    return JornadaRelatorioExtractor.extrairLinhas(jsonData)
  }

  static extrairLinhas(jsonData: LinhaRelatorio[]): LinhaJornadaBruta[] {
    return JornadaRelatorioExtractor.extrairLinhas(jsonData)
  }

  static processar(linhas: LinhaJornadaBruta[], edicoes: EdicoesJornada = SEM_EDICOES): LinhaRevisaoJornada[] {
    return JornadaRelatorioProcessador.processar(linhas, edicoes)
  }

  /** Extração + processamento sem edições, só o que vai pro calendário — usada nos testes. */
  static extrairDeLinhas(jsonData: LinhaRelatorio[]): RegistroJornadaRelatorio[] {
    return registrosParaImportar(this.processar(this.extrairLinhas(jsonData)))
  }
}
