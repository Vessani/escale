/**
 * Utilitários para formatação de datas e horas
 * Centralizado para reutilização em toda aplicação
 */

/**
 * Início do dia (00:00:00.000) da data informada
 */
export function inicioDoDia(data: Date): Date {
  const dia = new Date(data)
  dia.setHours(0, 0, 0, 0)
  return dia
}

/**
 * Converte uma data local (ano/mês/dia no fuso do servidor Node) para o
 * instante UTC correspondente à meia-noite desse mesmo dia — seguro para
 * gravar em colunas `@db.Date` do Postgres. Sem isso, timezones com offset
 * negativo (ex: Brasil, UTC-3) podem gravar o dia errado dependendo da hora.
 */
export function dataParaColunaDate(data: Date): Date {
  return new Date(Date.UTC(data.getFullYear(), data.getMonth(), data.getDate()))
}

/**
 * Converte um valor lido de uma coluna `@db.Date` (Prisma sempre retorna à
 * meia-noite UTC) de volta para meia-noite local do mesmo dia calendário —
 * seguro para comparar com outras datas locais (`inicioDoDia`, `dia`, `hoje`).
 * Sem isso, aplicar `inicioDoDia` direto num valor UTC desloca um dia inteiro
 * para trás em fusos com offset negativo.
 */
export function colunaDateParaLocal(dataColuna: Date): Date {
  return new Date(dataColuna.getUTCFullYear(), dataColuna.getUTCMonth(), dataColuna.getUTCDate())
}

/**
 * Fim do dia (23:59:59.999) da data informada
 */
export function fimDoDia(data: Date): Date {
  const dia = new Date(data)
  dia.setHours(23, 59, 59, 999)
  return dia
}

/**
 * Formata Date para string de input[type="date"] (YYYY-MM-DD)
 */
export function formatDateForDateInput(value: Date | string): string {
  const instant = new Date(value)
  const localDate = new Date(instant.getTime() - instant.getTimezoneOffset() * 60000)
  return localDate.toISOString().slice(0, 10)
}

/**
 * Formata Date para string de input[type="datetime-local"] (YYYY-MM-DDTHH:MM)
 */
export function formatDateTimeForInput(value: Date | string): string {
  const instant = new Date(value)
  const localDate = new Date(instant.getTime() - instant.getTimezoneOffset() * 60000)
  return localDate.toISOString().slice(0, 16)
}

/**
 * Formata data e hora no padrão pt-BR (DD/MM/YYYY HH:MM)
 */
export function formatarDataHoraPtBr(data: Date | string): string {
  const dataNormalizada = data instanceof Date ? data : new Date(data)

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(dataNormalizada)
}

/**
 * Formata só o horário do dia local, ex: "07:00" — usado pro horário
 * habitual de jornada (relatório importado), onde a data em si não importa.
 */
export function formatarHoraLocal(data: Date | string): string {
  const dataNormalizada = data instanceof Date ? data : new Date(data)
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(dataNormalizada)
}

/**
 * Formata data em diferentes formatos para datetime-local
 * Suporta: DD.MM, DD.MM.YYYY, serial Excel, Date object
 */
export function formatarDataExcel(data: string | Date, hora?: string): string {
  if (!data) return ''

  // Se já está em formato datetime-local
  if (typeof data === 'string' && data.includes('T')) return data

  let date: Date | null = null

  if (data instanceof Date) {
    date = data
  } else if (typeof data === 'string') {
    // Remove espaços e pontos finais (SAP às vezes adiciona "04.07." ao invés de "04.07")
    const dataNormalizada = data.trim().replace(/\.$/, '')
    
    // Formato DD.MM (ou DD.MM. do SAP)
    if (dataNormalizada.match(/^\d{2}\.\d{2}$/)) {
      const [dia, mes] = dataNormalizada.split('.')
      const ano = new Date().getFullYear()
      date = new Date(`${ano}-${mes}-${dia}T${hora || '00:00'}`)
    }
    // Formato DD.MM.YYYY
    else if (dataNormalizada.match(/^\d{2}\.\d{2}\.\d{4}$/)) {
      const [dia, mes, ano] = dataNormalizada.split('.')
      date = new Date(`${ano}-${mes}-${dia}T${hora || '00:00'}`)
    }
    // Serial do Excel (número)
    else if (!isNaN(Number(dataNormalizada))) {
      const excelDate = Number(dataNormalizada)
      const date1900 = new Date(1900, 0, 1)
      date = new Date(date1900.getTime() + (excelDate - 1) * 24 * 60 * 60 * 1000)
    }
  }

  if (!date || isNaN(date.getTime())) {
    return ''
  }

  return formatarDateTimeLocal(date, hora)
}

/**
 * Normaliza string de hora para formato HH:MM
 */
export function normalizarHora(hora: string): string {
  if (!hora) return '00:00'
  if (typeof hora !== 'string') return '00:00'

  const match = hora.match(/^(\d{1,2}):(\d{2})/)
  if (match) {
    const h = String(match[1]).padStart(2, '0')
    const m = String(match[2]).padStart(2, '0')
    return `${h}:${m}`
  }

  return '00:00'
}

/**
 * Converte uma string "YYYY-MM-DD" em Date local, validando que a data
 * existe de fato (rejeita ex: "2026-02-30")
 */
export function parseDataLocal(dataTexto: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dataTexto)) {
    throw new Error("Data inválida.")
  }

  const [anoTexto, mesTexto, diaTexto] = dataTexto.split("-")
  const ano = Number(anoTexto)
  const mes = Number(mesTexto)
  const dia = Number(diaTexto)
  const data = new Date(ano, mes - 1, dia)

  if (
    Number.isNaN(data.getTime()) ||
    data.getFullYear() !== ano ||
    data.getMonth() !== mes - 1 ||
    data.getDate() !== dia
  ) {
    throw new Error("Data inválida.")
  }

  return data
}

/**
 * Converte uma string "DD/MM/YYYY HH:MM:SS" (formato do Relatório Sintético
 * de Jornada) em Date local. Os segundos são opcionais.
 */
export function parseDataHoraBr(texto: string): Date {
  const match = texto.trim().match(/^(\d{2})\/(\d{2})\/(\d{4}) (\d{2}):(\d{2})(?::(\d{2}))?$/)

  if (!match) {
    throw new Error("Data/hora inválida.")
  }

  const [, diaTexto, mesTexto, anoTexto, horaTexto, minutoTexto, segundoTexto] = match
  const dia = Number(diaTexto)
  const mes = Number(mesTexto)
  const ano = Number(anoTexto)
  const hora = Number(horaTexto)
  const minuto = Number(minutoTexto)
  const segundo = segundoTexto ? Number(segundoTexto) : 0

  const data = new Date(ano, mes - 1, dia, hora, minuto, segundo)

  if (
    Number.isNaN(data.getTime()) ||
    data.getFullYear() !== ano ||
    data.getMonth() !== mes - 1 ||
    data.getDate() !== dia ||
    data.getHours() !== hora ||
    data.getMinutes() !== minuto
  ) {
    throw new Error("Data/hora inválida.")
  }

  return data
}

/**
 * Calcula dias entre duas datas (span inclusivo)
 * Retorna número de dias (mínimo 1)
 */
export function calcularDiasEntre(dataInicio: Date, dataFim: Date): number {
  const diffMs = dataFim.getTime() - dataInicio.getTime()
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24))
  return Math.max(1, diffDays + 1) // +1 para incluir o primeiro dia
}

/**
 * Formata Date para string datetime-local (YYYY-MM-DDTHH:MM)
 */
export function formatarDateTimeLocal(date: Date, hora?: string): string {
  const ano = date.getFullYear()
  const mes = String(date.getMonth() + 1).padStart(2, '0')
  const dia = String(date.getDate()).padStart(2, '0')

  if (hora) {
    return `${ano}-${mes}-${dia}T${hora}`
  }

  const h = String(date.getHours()).padStart(2, '0')
  const m = String(date.getMinutes()).padStart(2, '0')

  return `${ano}-${mes}-${dia}T${h}:${m}`
}

/**
 * Valida se um valor é um número válido e positivo
 */
export function validarNumeroPositivo(valor: unknown, campoNome: string): number {
  const num = typeof valor === 'string' ? parseFloat(valor) : typeof valor === 'number' ? valor : NaN

  if (isNaN(num)) {
    throw new Error(`${campoNome} inválido: deve ser um número`)
  }

  if (num < 0) {
    throw new Error(`${campoNome} inválido: deve ser positivo`)
  }

  return num
}
