import { lerPlanilhaDoArquivo } from "@/lib/excel/ler-arquivo-planilha"
import { turnoPorHora } from "@/lib/services/turno"
import { calcularDiasEntre, formatarDataExcel, formatarDateTimeLocal, normalizarHora, validarNumeroPositivo } from '@/lib/utils/date-format'

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
  entregas: DadosEntregaPlanilha[]
}

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
    let i = 0

    while (i < jsonData.length) {
      const startRow = this.findStartRowFrom(jsonData, i)

      if (startRow === -1) {
        break
      }

      const viagem = this.extrairViagem(jsonData, startRow)
      if (viagem) {
        viagens.push(viagem)
      }

      // Próxima iteração começa após as entregas desta viagem
      i = this.findNextViagemRow(jsonData, startRow)
    }

    if (viagens.length === 0) {
      throw new Error('Nenhuma viagem encontrada na planilha. Verifique se a coluna C contém o número da viagem.')
    }

    return viagens
  }

  private static findStartRowFrom(jsonData: LinhaPlanilha[], startFrom: number): number {
    // Procura na COLUNA C a partir de startFrom e procura por números da viagem
    for (let i = startFrom; i < jsonData.length; i++) {
      const valor = jsonData[i]['C']
      if (valor && String(valor).match(/^\d+$/)) {
        return i
      }
    }
    return -1
  }

  private static extrairViagem(jsonData: LinhaPlanilha[], viagemRow: number): DadosViagemPlanilha | null {
    const viagemData = jsonData[viagemRow]
    const numViagem = this.obterValor(viagemData['C'])

    if (!numViagem) return null

    // Estrutura do arquivo AR.xls:
    // C = Nº Viagem, F = Carreta, J = Cavalo, K = Data, L = Hora, AD = Tanque
    const diaInicio = this.obterValor(viagemData['K'])
    const horaInicio = normalizarHora(this.obterValor(viagemData['L']))

    const entregas = this.extrairEntregas(jsonData, viagemRow, numViagem)

    if (entregas.length === 0) {
      throw new Error(`Nenhuma entrega encontrada para a viagem ${numViagem}.`)
    }

    return {
      numViagem,
      carreta: this.obterValor(viagemData['F']),
      cavalo: this.obterValor(viagemData['J']),
      tanque: this.obterValor(viagemData['AD']),
      dataInicio: diaInicio,
      horaInicio,
      entregas
    }
  }

  private static extrairEntregas(jsonData: LinhaPlanilha[], viagemRow: number, numViagemAtual: string): DadosEntregaPlanilha[] {
    const entregas: DadosEntregaPlanilha[] = []

    for (let i = viagemRow + 1; i < jsonData.length; i++) {
      const row = jsonData[i]

      // Verifica se é uma nova viagem (número diferente na coluna C)
      const novoNumViagem = this.obterValor(row['C'])
      if (novoNumViagem && novoNumViagem !== numViagemAtual && String(novoNumViagem).match(/^\d+$/)) {
        break
      }

      // Para quando não houver cliente (coluna R)
      const clienteEntrega = this.obterValor(row['R'])
      if (!clienteEntrega) break

      try {
        // Estrutura real do arquivo AR.xls para entregas:
        // K = Data, L = Hora, R = Cliente, U = Cidade, V = UF
        // M = SAP Code, O = White Code, Y = Peso/KG, AC = Cubagem/M3, S = Obs
        const obs = this.obterValor(row['S'])
        const entrega: DadosEntregaPlanilha = {
          dataEntrega: this.obterValor(row['K']),
          horaEntrega: normalizarHora(this.obterValor(row['L'])),
          cliente: clienteEntrega,
          cidade: this.obterValor(row['U']) || clienteEntrega,
          uf: String(this.obterValor(row['V']) || 'SP').toUpperCase().substring(0, 2),
          kg: this.extrairNumeroPositivo(row['Y'], 'KG', i),
          m3: this.extrairNumeroPositivo(row['AC'], 'M3', i),
          sapcode: this.obterValor(row['M']) || '0',
          codewhite: this.obterValor(row['O']) || '0',
          obs: obs || 'Confirmar com a programação antes de sair'
        }
        entregas.push(entrega)
      } catch (erro) {
        throw new Error(`Erro ao processar entrega na linha ${i + 1}: ${erro instanceof Error ? erro.message : 'Erro desconhecido'}`)
      }
    }

    return entregas
  }

  private static findNextViagemRow(jsonData: LinhaPlanilha[], currentViagemRow: number): number {
    // Encontra a próxima linha com um número de viagem diferente
    const numViagemAtual = this.obterValor(jsonData[currentViagemRow]['C'])

    for (let i = currentViagemRow + 1; i < jsonData.length; i++) {
      const valor = this.obterValor(jsonData[i]['C'])
      if (valor && valor !== numViagemAtual && String(valor).match(/^\d+$/)) {
        return i
      }
    }

    return jsonData.length
  }

  private static obterValor(valor: unknown): string {
    return valor ? String(valor).trim() : ''
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
   * MANHA/NOITE conforme a hora de início da viagem: a partir das 16h é NOITE.
   */
  private static determinarTurnoPorHora(horaInicio: string): 'MANHA' | 'NOITE' {
    return turnoPorHora(Number(horaInicio.split(':')[0]))
  }

  static convert(dados: DadosViagemPlanilha) {
    const dataInicio = formatarDataExcel(dados.dataInicio, dados.horaInicio)

    if (!dataInicio) {
      throw new Error('Data de início inválida. Use formato DD.MM, DD.MM.YYYY ou serial Excel.')
    }

    // Calcula data fim como string, sem manter Date intermediário
    const dataFimString = this.calcularDataFimComoString(dados.entregas, dataInicio)

    return {
      numViagem: dados.numViagem || '',
      carreta: dados.carreta || '',
      // Veículos truck não têm cavalo separado; usa "0000" quando a planilha vem vazia
      cavalo: dados.cavalo || '0000',
      tanque: dados.tanque || '',
      diasViagem: this.calcularDiasViagemComoString(dataInicio, dataFimString),
      inicioPrevisto: dataInicio,
      fimPrevisto: dataFimString,
      turno: this.determinarTurnoPorHora(dados.horaInicio),
      status: 'CRIADA' as const,
      entregas: dados.entregas.map(e => this.converterEntrega(e))
    }
  }

  private static converterEntrega(entrega: DadosEntregaPlanilha) {
    return {
      cliente: entrega.cliente || '',
      cidade: entrega.cidade || '',
      uf: entrega.uf || 'SP',
      dataEntrega: formatarDataExcel(entrega.dataEntrega, entrega.horaEntrega || '12:00') || '',
      kg: entrega.kg || 0,
      m3: entrega.m3 || 0,
      sapcode: entrega.sapcode || '0',
      codewhite: entrega.codewhite || '0',
      obs: entrega.obs || 'Confirmar com a programação antes de sair'
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
export class XLSXParserViagem {
  static async parseFromFile(file: File): Promise<DadosViagemPlanilha[]> {
    return XLSXDataExtractor.extract(await lerPlanilhaDoArquivo(file))
  }

  /** Extração a partir das linhas já lidas ({ A, B, ... }) — sem I/O, usada nos testes. */
  static extrairDeLinhas(jsonData: LinhaPlanilha[]): DadosViagemPlanilha[] {
    return XLSXDataExtractor.extract(jsonData)
  }

  static converterParaFormulario(dados: DadosViagemPlanilha) {
    return XLSXToFormDataConverter.convert(dados)
  }

  static converterVariasViagensParaFormulario(viagens: DadosViagemPlanilha[]) {
    return viagens.map(viagem => this.converterParaFormulario(viagem))
  }
}

