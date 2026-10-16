import type { TipoProduto } from "@prisma/client"
import { lerPlanilhaDoArquivo } from "@/lib/excel/ler-arquivo-planilha"
import { produtoPeloNome } from "@/lib/services/produto.service"
import { turnoPorHora } from "@/lib/services/turno"
import { calcularDiasEntre, formatarDataExcel, formatarDateTimeLocal, normalizarHora, validarNumeroPositivo } from "@/lib/utils/date-format"

export interface DadosViagemPlanilha {
  numViagem: string
  carreta?: string
  cavalo?: string
  tanque?: string
  dataInicio: string
  horaInicio: string
  dataFim?: string
  horaFim?: string
  turno?: string
  /** Produto identificado pelo título da planilha (ex: "Oxigênio (Sul)"); ausente quando o título não diz. */
  produto?: TipoProduto
  /** Título original de onde o produto saiu — mostra "Oxigênio Laser (Sul)" mesmo virando OXIGENIO. */
  tituloProduto?: string
  entregas: DadosEntregaPlanilha[]
}

/** Viagens lidas de um arquivo, com o nome dele pra mensagens e pro resumo da importação. */
export interface ArquivoLido {
  nomeArquivo: string
  viagens: DadosViagemPlanilha[]
}

/** Quantos arquivos dá pra importar de uma vez (um por produto: oxigênio, nitrogênio, argônio...). */
export const MAX_ARQUIVOS_POR_IMPORTACAO = 5

export interface DadosEntregaPlanilha {
  dataEntrega: string
  horaEntrega?: string
  cliente: string
  cidade: string
  uf: string
  kg?: number
  m3?: number
  sapcode?: string
  codewhite?: string
  obs?: string
}

/** Uma linha crua da planilha, indexada por letra de coluna (formato `sheet_to_json({ header: 'A' })`) */
type LinhaPlanilha = Record<string, unknown>

/**
 * Extrator de dados brutos do XLSX
 * Responsabilidade única: ler e extrair dados da planilha
 */
class XLSXDataExtractor {
  static extract(jsonData: LinhaPlanilha[]): DadosViagemPlanilha[] {
    const viagens: DadosViagemPlanilha[] = []
    const titulo = this.encontrarTituloDoProduto(jsonData)
    let i = 0

    while (i < jsonData.length) {
      const startRow = this.findStartRowFrom(jsonData, i)

      if (startRow === -1) {
        break
      }

      const viagem = this.extrairViagem(jsonData, startRow)
      if (viagem) {
        viagens.push(titulo ? { ...viagem, produto: titulo.produto, tituloProduto: titulo.texto } : viagem)
      }

      // Próxima iteração começa após as entregas desta viagem
      i = this.findNextViagemRow(jsonData, startRow)
    }

    if (viagens.length === 0) {
      throw new Error("Nenhuma viagem encontrada na planilha. Verifique se a coluna C contém o número da viagem.")
    }

    return viagens
  }

  /**
   * O relatório traz o produto no cabeçalho, antes da primeira viagem (célula
   * B4: "Oxigênio (Sul)"). Procura só ali: no meio das viagens, nome de
   * cliente como "O2 L / GASES" não pode decidir o produto.
   */
  private static encontrarTituloDoProduto(jsonData: LinhaPlanilha[]): { produto: TipoProduto; texto: string } | null {
    const primeiraViagem = this.findStartRowFrom(jsonData, 0)
    const cabecalho = primeiraViagem === -1 ? jsonData : jsonData.slice(0, primeiraViagem)

    for (const linha of cabecalho) {
      for (const valor of Object.values(linha)) {
        if (typeof valor !== "string") continue
        const produto = produtoPeloNome(valor)
        if (produto) return { produto, texto: valor.trim() }
      }
    }
    return null
  }

  private static findStartRowFrom(jsonData: LinhaPlanilha[], startFrom: number): number {
    // Procura na COLUNA C a partir de startFrom e procura por números da viagem
    for (let i = startFrom; i < jsonData.length; i++) {
      const valor = jsonData[i]["C"]
      if (valor && String(valor).match(/^\d+$/)) {
        return i
      }
    }
    return -1
  }

  private static extrairViagem(jsonData: LinhaPlanilha[], viagemRow: number): DadosViagemPlanilha | null {
    const viagemData = jsonData[viagemRow]
    const numViagem = this.obterValor(viagemData["C"])

    if (!numViagem) return null

    // Estrutura do arquivo AR.xls:
    // C = Nº Viagem, F = Carreta, J = Cavalo, K = Data, L = Hora, AD = Tanque
    const diaInicio = this.obterValor(viagemData["K"])
    const horaInicio = normalizarHora(this.obterValor(viagemData["L"]))

    const entregas = this.extrairEntregas(jsonData, viagemRow, numViagem)

    if (entregas.length === 0) {
      throw new Error(`Nenhuma entrega encontrada para a viagem ${numViagem}.`)
    }

    return {
      numViagem,
      carreta: this.obterValor(viagemData["F"]),
      cavalo: this.obterValor(viagemData["J"]),
      tanque: this.obterValor(viagemData["AD"]),
      dataInicio: diaInicio,
      horaInicio,
      entregas,
    }
  }

  private static extrairEntregas(jsonData: LinhaPlanilha[], viagemRow: number, numViagemAtual: string): DadosEntregaPlanilha[] {
    const entregas: DadosEntregaPlanilha[] = []

    for (let i = viagemRow + 1; i < jsonData.length; i++) {
      const row = jsonData[i]

      // Verifica se é uma nova viagem (número diferente na coluna C)
      const novoNumViagem = this.obterValor(row["C"])
      if (novoNumViagem && novoNumViagem !== numViagemAtual && String(novoNumViagem).match(/^\d+$/)) {
        break
      }

      // Para quando não houver cliente (coluna R)
      const clienteEntrega = this.obterValor(row["R"])
      if (!clienteEntrega) break

      try {
        // Estrutura real do arquivo AR.xls para entregas:
        // K = Data, L = Hora, R = Cliente, U = Cidade, V = UF
        // M = SAP Code, O = White Code, Y = Peso/KG, AC = Cubagem/M3, S = Obs
        const obs = this.obterValor(row["S"])
        const entrega: DadosEntregaPlanilha = {
          dataEntrega: this.obterValor(row["K"]),
          horaEntrega: normalizarHora(this.obterValor(row["L"])),
          cliente: clienteEntrega,
          cidade: this.obterValor(row["U"]) || clienteEntrega,
          uf: String(this.obterValor(row["V"]) || "SP")
            .toUpperCase()
            .substring(0, 2),
          kg: this.extrairNumeroPositivo(row["Y"], "KG", i),
          m3: this.extrairNumeroPositivo(row["AC"], "M3", i),
          sapcode: this.obterValor(row["M"]) || "0",
          codewhite: this.obterValor(row["O"]) || "0",
          obs: obs || "Confirmar com a programação antes de sair",
        }
        entregas.push(entrega)
      } catch (erro) {
        throw new Error(`Erro ao processar entrega na linha ${i + 1}: ${erro instanceof Error ? erro.message : "Erro desconhecido"}`)
      }
    }

    return entregas
  }

  private static findNextViagemRow(jsonData: LinhaPlanilha[], currentViagemRow: number): number {
    // Encontra a próxima linha com um número de viagem diferente
    const numViagemAtual = this.obterValor(jsonData[currentViagemRow]["C"])

    for (let i = currentViagemRow + 1; i < jsonData.length; i++) {
      const valor = this.obterValor(jsonData[i]["C"])
      if (valor && valor !== numViagemAtual && String(valor).match(/^\d+$/)) {
        return i
      }
    }

    return jsonData.length
  }

  private static obterValor(valor: unknown): string {
    return valor ? String(valor).trim() : ""
  }

  private static extrairNumeroPositivo(valor: unknown, nomeCampo: string, linha: number): number {
    if (!valor) return 0

    try {
      return validarNumeroPositivo(valor, `${nomeCampo} (linha ${linha + 1})`)
    } catch (erro) {
      throw erro
    }
  }
}

/**
 * Conversor de dados XLSX para formato de formulário
 * Responsabilidade única: converter formatos de dados
 *
 * Importante: retorna apenas strings para datas (não Date objects) —
 * Date objects não são serializáveis em JSON para Next.js server actions
 */

class XLSXToFormDataConverter {
  /**
   * MANHA/NOITE conforme a hora de início da viagem: NOITE das 16:00 às 03:59.
   */
  private static determinarTurnoPorHora(horaInicio: string): "MANHA" | "NOITE" {
    return turnoPorHora(Number(horaInicio.split(":")[0]))
  }

  static convert(dados: DadosViagemPlanilha) {
    const dataInicio = formatarDataExcel(dados.dataInicio, dados.horaInicio)

    if (!dataInicio) {
      throw new Error("Data de início inválida. Use formato DD.MM, DD.MM.YYYY ou serial Excel.")
    }

    // Calcula data fim como string, sem manter Date intermediário
    const dataFimString = this.calcularDataFimComoString(dados.entregas, dataInicio)

    return {
      numViagem: dados.numViagem || "",
      carreta: dados.carreta || "",
      // Veículos truck não têm cavalo separado; usa "0000" quando a planilha vem vazia
      cavalo: dados.cavalo || "0000",
      tanque: dados.tanque || "",
      produto: dados.produto,
      diasViagem: this.calcularDiasViagemComoString(dataInicio, dataFimString),
      inicioPrevisto: dataInicio,
      fimPrevisto: dataFimString,
      turno: this.determinarTurnoPorHora(dados.horaInicio),
      status: "CRIADA" as const,
      entregas: dados.entregas.map((e) => this.converterEntrega(e)),
    }
  }

  private static converterEntrega(entrega: DadosEntregaPlanilha) {
    return {
      cliente: entrega.cliente || "",
      cidade: entrega.cidade || "",
      uf: entrega.uf || "SP",
      dataEntrega: formatarDataExcel(entrega.dataEntrega, entrega.horaEntrega || "12:00") || "",
      kg: entrega.kg || 0,
      m3: entrega.m3 || 0,
      sapcode: entrega.sapcode || "0",
      codewhite: entrega.codewhite || "0",
      obs: entrega.obs || "Confirmar com a programação antes de sair",
    }
  }

  /** Dias entre duas datas STRING (datetime-local) — mesma regra de calcularDiasEntre (date-format.ts). */
  private static calcularDiasViagemComoString(dataInicioStr: string, dataFimStr: string): number {
    return calcularDiasEntre(new Date(dataInicioStr), new Date(dataFimStr))
  }

  /**
   * Calcula data fim a partir das entregas, retornando como STRING
   * Sem manter Date objects
   */
  private static calcularDataFimComoString(entregas: DadosEntregaPlanilha[], dataInicioStr: string): string {
    if (entregas.length === 0) {
      return dataInicioStr
    }

    let dataUltimaMs = new Date(dataInicioStr).getTime()

    for (const entrega of entregas) {
      const dataStr = formatarDataExcel(entrega.dataEntrega, entrega.horaEntrega)
      if (dataStr) {
        const dataMs = new Date(dataStr).getTime()
        if (dataMs > dataUltimaMs) {
          dataUltimaMs = dataMs
        }
      }
    }

    // formatarDateTimeLocal (não toISOString) preserva o horário local: converter
    // pra UTC e reinterpretar a string resultante como hora local deslocaria a
    // data em fusos negativos (ex: Brasil), inflando diasViagem em 1.
    return formatarDateTimeLocal(new Date(dataUltimaMs))
  }
}

/**
 * Parser Principal - Orquestra os componentes
 * Responsabilidade: coordenar leitura, extração e conversão
 */
/** Duração prevista (início → volta à base) em minutos, da mesma conta que vai pro formulário. */
function minutosEntre(inicioPrevisto: string, fimPrevisto: string): number {
  return (new Date(fimPrevisto).getTime() - new Date(inicioPrevisto).getTime()) / 60_000
}

export class XLSXParserViagem {
  static async parseFromFile(file: File): Promise<DadosViagemPlanilha[]> {
    return XLSXDataExtractor.extract(await lerPlanilhaDoArquivo(file))
  }

  /**
   * Lê até MAX_ARQUIVOS_POR_IMPORTACAO arquivos (um por produto, normalmente).
   * O erro de um arquivo leva o nome dele, pra saber qual corrigir.
   */
  static async parseVariosArquivos(arquivos: File[]): Promise<ArquivoLido[]> {
    if (arquivos.length > MAX_ARQUIVOS_POR_IMPORTACAO) {
      throw new Error(`Envie no máximo ${MAX_ARQUIVOS_POR_IMPORTACAO} arquivos por vez (foram ${arquivos.length}).`)
    }
    return Promise.all(
      arquivos.map(async (arquivo) => {
        try {
          return { nomeArquivo: arquivo.name, viagens: await this.parseFromFile(arquivo) }
        } catch (erro) {
          throw new Error(`${arquivo.name}: ${erro instanceof Error ? erro.message : "Erro desconhecido"}`)
        }
      }),
    )
  }

  /**
   * Junta as viagens de todos os arquivos, da mais longa pra mais curta. A
   * ordem importa: a sugestão em lote (sugerirAlocacoesEmLote) escolhe
   * motorista na ordem recebida, então a viagem longa pega o melhor encaixe
   * antes das curtas. Empate: sai primeiro quem começa antes.
   * A mesma viagem em dois arquivos é erro — criaria a viagem duas vezes.
   */
  static juntarArquivos(arquivos: ArquivoLido[]): DadosViagemPlanilha[] {
    const arquivoDaViagem = new Map<string, string>()
    for (const { nomeArquivo, viagens } of arquivos) {
      for (const { numViagem } of viagens) {
        const anterior = arquivoDaViagem.get(numViagem)
        if (anterior !== undefined && anterior !== nomeArquivo) {
          throw new Error(`A viagem ${numViagem} aparece em dois arquivos (${anterior} e ${nomeArquivo}). Remova um deles.`)
        }
        arquivoDaViagem.set(numViagem, nomeArquivo)
      }
    }
    return this.ordenarDaMaisLongaParaMaisCurta(arquivos.flatMap((arquivo) => arquivo.viagens))
  }

  static ordenarDaMaisLongaParaMaisCurta(viagens: DadosViagemPlanilha[]): DadosViagemPlanilha[] {
    return viagens
      .map((viagem) => {
        const { inicioPrevisto, fimPrevisto } = XLSXToFormDataConverter.convert(viagem)
        return { viagem, duracao: minutosEntre(inicioPrevisto, fimPrevisto), inicio: inicioPrevisto }
      })
      .sort((a, b) => b.duracao - a.duracao || a.inicio.localeCompare(b.inicio))
      .map(({ viagem }) => viagem)
  }

  static duracaoPrevistaMinutos(viagem: DadosViagemPlanilha): number {
    const { inicioPrevisto, fimPrevisto } = XLSXToFormDataConverter.convert(viagem)
    return minutosEntre(inicioPrevisto, fimPrevisto)
  }

  /** Extração a partir das linhas já lidas ({ A, B, ... }) — sem I/O, usada nos testes. */
  static extrairDeLinhas(jsonData: LinhaPlanilha[]): DadosViagemPlanilha[] {
    return XLSXDataExtractor.extract(jsonData)
  }

  static converterParaFormulario(dados: DadosViagemPlanilha) {
    return XLSXToFormDataConverter.convert(dados)
  }

  static converterVariasViagensParaFormulario(viagens: DadosViagemPlanilha[]) {
    return viagens.map((viagem) => this.converterParaFormulario(viagem))
  }
}
