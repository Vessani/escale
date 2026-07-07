import * as XLSX from 'xlsx'
import { formatarDataExcel, normalizarHora, validarNumeroPositivo } from '@/lib/utils/date-format'

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
 * ⚠️ IMPORTANTE: Retorna APENAS strings para datas (não Date objects)
 * Motivo: Date objects não são serializáveis em JSON para Next.js server actions
 */
class XLSXToFormDataConverter {
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
      cavalo: dados.cavalo || '',
      tanque: dados.tanque || '',
      diasViagem: this.calcularDiasViagemComoString(dataInicio, dataFimString),
      inicioPrevisto: dataInicio,
      fimPrevisto: dataFimString,
      turno: 'MANHA' as const,
      status: 'CRIADA' as const,
      entregas: dados.entregas.map(e => ({
        cliente: e.cliente || '',
        cidade: e.cidade || '',
        uf: e.uf || 'SP',
        dataEntrega: formatarDataExcel(e.dataEntrega, e.horaEntrega || '12:00') || '',
        kg: e.kg || 0,
        m3: e.m3 || 0,
        sapcode: e.sapcode || '0',
        codewhite: e.codewhite || '0',
        obs: e.obs || 'Confirmar com a programação antes de sair'
      }))
    }
  }

  /**
   * Calcula dias entre duas datas STRING (datetime-local)
   * Sem manter Date objects
   */
  private static calcularDiasViagemComoString(dataInicioStr: string, dataFimStr: string): number {
    const dataInicio = new Date(dataInicioStr)
    const dataFim = new Date(dataFimStr)
    const diffMs = dataFim.getTime() - dataInicio.getTime()
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24))
    return Math.max(1, diffDays + 1)
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
      const dataStr = formatarDataExcel(entrega.dataEntrega)
      if (dataStr) {
        const dataMs = new Date(dataStr).getTime()
        if (dataMs > dataUltimaMs) {
          dataUltimaMs = dataMs
        }
      }
    }

    return new Date(dataUltimaMs).toISOString().replace('Z', '').substring(0, 16)
  }
}

/**
 * Leitor de arquivo XLSX
 * Responsabilidade única: ler arquivo binário e converter para JSON
 */
class XLSXFileReader {
  static readFile(file: File): Promise<LinhaPlanilha[]> {
    return new Promise((resolve, reject) => {
      this.validateFile(file)

      const reader = new FileReader()

      reader.onload = (event) => {
        try {
          const data = new Uint8Array(event.target?.result as ArrayBuffer)
          const workbook = XLSX.read(data, { type: 'array' })
          const sheetName = workbook.SheetNames[0]

          if (!sheetName) {
            reject(new Error('Planilha vazia ou inválida'))
            return
          }

          const worksheet = workbook.Sheets[sheetName]
          const jsonData = XLSX.utils.sheet_to_json<LinhaPlanilha>(worksheet, { header: 'A' })

          resolve(jsonData)
        } catch (error) {
          reject(new Error(
            `Erro ao processar arquivo XLSX: ${error instanceof Error ? error.message : 'Erro desconhecido'}`
          ))
        }
      }

      reader.onerror = () => {
        reject(new Error('Erro ao ler arquivo. Verifique se o arquivo não está corrompido.'))
      }

      reader.readAsArrayBuffer(file)
    })
  }

  private static validateFile(file: File): void {
    if (!file) {
      throw new Error('Arquivo não fornecido')
    }

    const validMimeTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
      'application/vnd.ms-excel' // .xls
    ]

    const validExtensions = /\.(xlsx|xls)$/i

    if (file.type && !validMimeTypes.includes(file.type)) {
      throw new Error(`Tipo de arquivo inválido. Tipo detectado: ${file.type}`)
    }

    if (!validExtensions.test(file.name)) {
      throw new Error('Nome de arquivo inválido. Use arquivo .xlsx ou .xls')
    }

    const maxSizeBytes = 10 * 1024 * 1024 // 10MB
    if (file.size > maxSizeBytes) {
      throw new Error(`Arquivo muito grande. Máximo: 10MB, fornecido: ${(file.size / 1024 / 1024).toFixed(2)}MB`)
    }
  }
}

/**
 * Parser Principal - Orquestra os componentes
 * Responsabilidade: coordenar leitura, extração e conversão
 */
export class XLSXParserViagem {
  static async parseFromFile(file: File): Promise<DadosViagemPlanilha[]> {
    const jsonData = await XLSXFileReader.readFile(file)
    return XLSXDataExtractor.extract(jsonData)
  }

  static converterParaFormulario(dados: DadosViagemPlanilha) {
    return XLSXToFormDataConverter.convert(dados)
  }

  static converterVariasViagensParaFormulario(viagens: DadosViagemPlanilha[]) {
    return viagens.map(viagem => this.converterParaFormulario(viagem))
  }
}

