import { parseStatusFiltro, type FiltroStatusViagem } from "./viagem-status.service"
import { formatDateForDateInput, inicioDoDia, parseDataLocal } from "@/lib/utils/date-format"

/** Quantas viagens por página na Gestão de Viagens. */
export const VIAGENS_POR_PAGINA = 50

/** Período padrão da lista: uma semana pra trás e um mês pra frente — cobre o que a operação mexe no dia a dia. */
const DIAS_ANTES_PADRAO = 7
const DIAS_DEPOIS_PADRAO = 30

/** Período máximo aceito, pra ninguém pedir "desde sempre" sem querer e trazer o histórico inteiro. */
export const DIAS_MAXIMOS_PERIODO = 366

const UM_DIA_MS = 24 * 60 * 60 * 1000

export type FiltroListaViagens = {
  status: FiltroStatusViagem
  /** Início do dia (Brasília) do começo do período. */
  de: Date
  /** Início do dia (Brasília) do fim do período — inclusivo. */
  ate: Date
  /** Número de viagem (parcial). Quando preenchido, ignora o período — quem busca um número quer achar a viagem onde ela estiver. */
  busca: string
  pagina: number
}

type ParametrosBrutos = {
  status?: string | string[]
  de?: string | string[]
  ate?: string | string[]
  q?: string | string[]
  pagina?: string | string[]
}

function primeiro(valor: string | string[] | undefined): string | undefined {
  return Array.isArray(valor) ? valor[0] : valor
}

function parseDiaOuPadrao(texto: string | undefined, padrao: Date): Date {
  if (!texto) return padrao
  try {
    return parseDataLocal(texto)
  } catch {
    return padrao
  }
}

/**
 * Lê os filtros da URL da Gestão de Viagens (?status, ?de, ?ate, ?q,
 * ?pagina) com valores padrão seguros — qualquer valor inválido cai no
 * padrão em vez de quebrar a página. Pura, pra poder testar sem banco.
 */
export function parseFiltroListaViagens(parametros: ParametrosBrutos, agora: Date = new Date()): FiltroListaViagens {
  const hoje = inicioDoDia(agora)
  const dePadrao = new Date(hoje.getTime() - DIAS_ANTES_PADRAO * UM_DIA_MS)
  const atePadrao = new Date(hoje.getTime() + DIAS_DEPOIS_PADRAO * UM_DIA_MS)

  let de = parseDiaOuPadrao(primeiro(parametros.de), dePadrao)
  let ate = parseDiaOuPadrao(primeiro(parametros.ate), atePadrao)

  if (ate < de) {
    ;[de, ate] = [ate, de]
  }

  if (ate.getTime() - de.getTime() > DIAS_MAXIMOS_PERIODO * UM_DIA_MS) {
    de = new Date(ate.getTime() - DIAS_MAXIMOS_PERIODO * UM_DIA_MS)
  }

  const paginaBruta = Number.parseInt(primeiro(parametros.pagina) ?? "1", 10)

  return {
    status: parseStatusFiltro(primeiro(parametros.status)),
    de,
    ate,
    busca: (primeiro(parametros.q) ?? "").trim().slice(0, 12),
    pagina: Number.isInteger(paginaBruta) && paginaBruta > 0 ? paginaBruta : 1,
  }
}

/** Monta a query string de um filtro (pra links de paginação e de status), omitindo o que está no padrão. */
export function montarQueryFiltroViagens(filtro: FiltroListaViagens, mudancas: Partial<FiltroListaViagens> = {}): string {
  const final = { ...filtro, ...mudancas }
  const parametros = new URLSearchParams()

  if (final.status !== "TODOS") parametros.set("status", final.status)
  if (final.busca) {
    parametros.set("q", final.busca)
  } else {
    parametros.set("de", formatDateForDateInput(final.de))
    parametros.set("ate", formatDateForDateInput(final.ate))
  }
  if (final.pagina > 1) parametros.set("pagina", String(final.pagina))

  const texto = parametros.toString()
  return texto ? `?${texto}` : ""
}
