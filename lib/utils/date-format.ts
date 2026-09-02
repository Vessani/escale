/**
 * Utilitários para formatação de datas e horas
 * Centralizado para reutilização em toda aplicação
 */

import { DataInvalidaError } from "@/lib/errors"

/**
 * A transportadora opera só no Brasil, e desde 2019 o país não tem mais
 * horário de verão em nenhum estado — então o offset de Brasília é constante
 * (UTC-3) o ano inteiro. Usado tanto pra interpretar/exibir campos de
 * data+hora digitados pelo usuário quanto por inicioDoDia/fimDoDia, de forma
 * correta independente do fuso horário do processo que executa o código —
 * sem isso, calcular "hoje" (dashboard, motoristas ociosos, relatório
 * diário...) num servidor rodando em UTC (comum em produção, ex: Vercel;
 * `.env.example` documenta `TZ=America/Sao_Paulo`, mas depender só da
 * variável de ambiente é frágil — se ela não estiver setada, "hoje" adianta
 * até 3h à noite, contando viagens do fim do dia como se fossem de amanhã).
 * Se o Brasil voltar a ter horário de verão em algum estado no futuro, este
 * valor precisa ser revisto.
 */
const OFFSET_MINUTOS_BRASILIA = 3 * 60

/**
 * Início do dia (00:00:00.000, horário de Brasília) do instante informado —
 * ver OFFSET_MINUTOS_BRASILIA sobre por que é calculado com um offset fixo
 * em vez de `Date.setHours` (que usa o fuso do processo).
 */
export function inicioDoDia(data: Date): Date {
  const brasilia = new Date(data.getTime() - OFFSET_MINUTOS_BRASILIA * 60 * 1000)
  const meiaNoiteUtc = Date.UTC(brasilia.getUTCFullYear(), brasilia.getUTCMonth(), brasilia.getUTCDate())
  return new Date(meiaNoiteUtc + OFFSET_MINUTOS_BRASILIA * 60 * 1000)
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
 * Fim do dia (23:59:59.999, horário de Brasília) — ver inicioDoDia.
 */
export function fimDoDia(data: Date): Date {
  return new Date(inicioDoDia(data).getTime() + 24 * 60 * 60 * 1000 - 1)
}

/** Formato exato que <input type="datetime-local"> produz — sem timezone, com ou sem segundos. */
const REGEX_DATETIME_LOCAL_SEM_FUSO = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?$/

/**
 * Interpreta uma string "YYYY-MM-DDTHH:MM" (ou com segundos) — o formato que
 * <input type="datetime-local"> sempre produz — como horário de Brasília, e
 * devolve o instante UTC correspondente. Ao contrário de `new Date(texto)`,
 * não depende do fuso horário do processo que executa o código (ver
 * OFFSET_MINUTOS_BRASILIA). Lança erro para datas de calendário inválidas
 * (ex: "2026-02-30") ou fora do formato esperado.
 */
export function parseDateTimeFromInput(texto: string): Date {
  const match = texto.match(REGEX_DATETIME_LOCAL_SEM_FUSO)

  if (!match) {
    throw new Error(`Data/hora inválida: ${texto}`)
  }

  const [, anoTexto, mesTexto, diaTexto, horaTexto, minutoTexto, segundoTexto] = match
  const ano = Number(anoTexto)
  const mes = Number(mesTexto)
  const dia = Number(diaTexto)
  const hora = Number(horaTexto)
  const minuto = Number(minutoTexto)
  const segundo = segundoTexto ? Number(segundoTexto) : 0

  // Valida o calendário em UTC puro (sem aplicar o offset ainda) — Date.UTC
  // não rejeita "30 de fevereiro" sozinho, só rola pro mês seguinte.
  const candidato = new Date(Date.UTC(ano, mes - 1, dia, hora, minuto, segundo))
  const valido =
    !Number.isNaN(candidato.getTime()) &&
    candidato.getUTCFullYear() === ano &&
    candidato.getUTCMonth() === mes - 1 &&
    candidato.getUTCDate() === dia &&
    candidato.getUTCHours() === hora &&
    candidato.getUTCMinutes() === minuto

  if (!valido) {
    throw new Error(`Data/hora inválida: ${texto}`)
  }

  return new Date(candidato.getTime() + OFFSET_MINUTOS_BRASILIA * 60 * 1000)
}

/**
 * Converte um valor de data+hora vindo de uma server action (string de
 * <input type="datetime-local">, ou já um Date) pro Date correto. Strings
 * sem timezone (o formato do input) são interpretadas como horário de
 * Brasília via `parseDateTimeFromInput`; strings que já trazem "Z" ou offset
 * explícito (ex: vindas de `serializeData`, que sempre usa `toISOString()`)
 * e objetos Date passam direto — reaplicar o offset de Brasília nelas
 * corromperia um instante que já está correto.
 */
export function converterEntradaDeDataHora(valor: string | Date): Date {
  if (valor instanceof Date) return valor
  return REGEX_DATETIME_LOCAL_SEM_FUSO.test(valor) ? parseDateTimeFromInput(valor) : new Date(valor)
}

/**
 * Formata Date para string de input[type="date"] (YYYY-MM-DD). Usado só com
 * valores de colunas `@db.Date` (ex: validade de integração) — que o Prisma
 * sempre devolve à meia-noite UTC (ver `colunaDateParaLocal`) — por isso lê
 * os componentes em UTC, sem aplicar nenhum offset: aplicar o offset de
 * Brasília aqui cruzaria a meia-noite e mostraria o dia anterior.
 */
export function formatDateForDateInput(value: Date | string): string {
  const instant = new Date(value)
  const ano = instant.getUTCFullYear()
  const mes = String(instant.getUTCMonth() + 1).padStart(2, "0")
  const dia = String(instant.getUTCDate()).padStart(2, "0")
  return `${ano}-${mes}-${dia}`
}

/**
 * Formata um instante (Date ou string) como horário de Brasília, no formato
 * de <input type="datetime-local"> (YYYY-MM-DDTHH:MM). Usa o offset fixo de
 * Brasília (ver OFFSET_MINUTOS_BRASILIA) em vez do fuso do navegador/processo
 * — mostra o mesmo horário pra qualquer pessoa, em qualquer ambiente.
 */
export function formatDateTimeForInput(value: Date | string): string {
  const instant = new Date(value)
  const brasilia = new Date(instant.getTime() - OFFSET_MINUTOS_BRASILIA * 60 * 1000)
  return brasilia.toISOString().slice(0, 16)
}

/**
 * Formata data e hora no padrão pt-BR (DD/MM/YYYY HH:MM), sempre como horário
 * de Brasília — sem `timeZone` explícito, o Intl usa o fuso ambiente do
 * processo (servidor ou navegador), que nem sempre é Brasília (mesma causa
 * raiz de OFFSET_MINUTOS_BRASILIA acima).
 */
export function formatarDataHoraPtBr(data: Date | string): string {
  const dataNormalizada = data instanceof Date ? data : new Date(data)

  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
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
    
    // Formato DD.MM (ou DD.MM. do SAP) — a planilha não traz o ano, então
    // assumimos o ano corrente. Se o resultado cair muito no futuro (ex:
    // "30.12" importado em janeiro), a data quase certamente é do ano
    // anterior — planilhas de operação não chegam com meses de antecedência.
    if (dataNormalizada.match(/^\d{2}\.\d{2}$/)) {
      const [dia, mes] = dataNormalizada.split('.')
      let ano = new Date().getFullYear()
      let candidata = new Date(`${ano}-${mes}-${dia}T${hora || '00:00'}`)

      const LIMITE_DIAS_FUTURO = 60
      const limiteFuturo = new Date()
      limiteFuturo.setDate(limiteFuturo.getDate() + LIMITE_DIAS_FUTURO)

      if (!isNaN(candidata.getTime()) && candidata > limiteFuturo) {
        ano -= 1
        candidata = new Date(`${ano}-${mes}-${dia}T${hora || '00:00'}`)
      }

      date = candidata
    }
    // Formato DD.MM.YYYY
    else if (dataNormalizada.match(/^\d{2}\.\d{2}\.\d{4}$/)) {
      const [dia, mes, ano] = dataNormalizada.split('.')
      date = new Date(`${ano}-${mes}-${dia}T${hora || '00:00'}`)
    }
    // Serial do Excel (número)
    else if (!isNaN(Number(dataNormalizada))) {
      const excelDate = Number(dataNormalizada)
      // Excel conta os dias a partir de 30/12/1899 (a "epoch" 1900 do Excel
      // trata 1900 como bissexto por um bug histórico, então o dia 0 do
      // sistema equivale a 30/12/1899). Calcular em UTC e depois montar a
      // data local evita que o fuso desloque o dia. Serial inteiro = meia-
      // noite; a parte fracionária (hora do dia) é ignorada aqui porque o
      // horário vem do parâmetro `hora`.
      const MS_POR_DIA = 24 * 60 * 60 * 1000
      const epochExcelUTC = Date.UTC(1899, 11, 30)
      const utc = new Date(epochExcelUTC + Math.floor(excelDate) * MS_POR_DIA)
      date = new Date(utc.getUTCFullYear(), utc.getUTCMonth(), utc.getUTCDate())
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
 * Converte uma string "YYYY-MM-DD" (ex: o parâmetro `?data=` de um filtro, ou
 * o dia clicado no calendário do motorista) no instante correspondente à
 * meia-noite de Brasília, validando que a data existe de fato (rejeita ex:
 * "2026-02-30") — mesma lógica de `parseDateTimeFromInput`, e pelo mesmo
 * motivo: construir com `new Date(ano, mes-1, dia)` usaria o fuso do
 * processo que executa o código, não o de Brasília. Antes dessa correção,
 * um servidor rodando em UTC (comum em produção) gravava o dia clicado no
 * calendário como o dia ANTERIOR — `inicioDoDia`, chamado em seguida por
 * quase todo consumidor desta função, sempre assume que já recebeu um
 * instante real, e subtrai 3h dele; sem o offset aplicado aqui antes, isso
 * cruzava a meia-noite pro dia errado.
 */
export function parseDataLocal(dataTexto: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dataTexto)) {
    throw new DataInvalidaError()
  }

  const [anoTexto, mesTexto, diaTexto] = dataTexto.split("-")
  const ano = Number(anoTexto)
  const mes = Number(mesTexto)
  const dia = Number(diaTexto)
  const candidato = new Date(Date.UTC(ano, mes - 1, dia))

  const valido =
    !Number.isNaN(candidato.getTime()) &&
    candidato.getUTCFullYear() === ano &&
    candidato.getUTCMonth() === mes - 1 &&
    candidato.getUTCDate() === dia

  if (!valido) {
    throw new DataInvalidaError()
  }

  return new Date(candidato.getTime() + OFFSET_MINUTOS_BRASILIA * 60 * 1000)
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
 * Quantos dias do ciclo de trabalho do motorista uma viagem consome —
 * horas corridas divididas por 24, arredondado pra cima (mínimo 1). Ex:
 * 14/08 08:00 → 15/08 19:00 são 35h reais = 2 dias, não 3 — contar por
 * "datas de calendário tocadas" (como uma versão antiga fazia, com um "+1")
 * inflava a conta sempre que o horário de início não era meia-noite, e
 * bloqueava motoristas que na prática tinham dias de ciclo suficientes.
 */
export function calcularDiasEntre(dataInicio: Date, dataFim: Date): number {
  const diffMs = dataFim.getTime() - dataInicio.getTime()
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24))
  return Math.max(1, diffDays)
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
