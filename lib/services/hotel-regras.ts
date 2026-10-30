/**
 * Regras do pedido de hotel sem banco nem Node — usadas no servidor e na tela.
 * O que mexe no banco fica em hotel.service.ts; o que é comum a todo pedido
 * por link (validade, situação, wa.me), em link-aprovacao-regras.ts.
 */

import { linhasDaViagem, type ViagemDoPedidoComFrota } from "@/lib/services/link-aprovacao-regras"

/** Cidade do pernoite e nome do hotel são texto livre — limites das colunas. */
export const TAMANHO_MAXIMO_CIDADE_HOTEL = 100
export const TAMANHO_MAXIMO_NOME_HOTEL = 150

/** Até quantos dias pra frente dá pra pedir o hotel (o de ontem ainda vale: pedido feito de madrugada). */
export const DIAS_MAXIMOS_ANTECEDENCIA_HOTEL = 30

const UM_DIA_MS = 24 * 60 * 60 * 1000
/** Brasília é UTC-3 fixo (sem horário de verão) — mesmo critério de lib/utils/date-format.ts. */
const OFFSET_BRASILIA_MS = 3 * 60 * 60 * 1000

/** "2026-10-29": o dia de hoje em Brasília, no formato de <input type="date">. */
export function diaEmBrasilia(agora: Date, deslocamentoDias = 0): string {
  return new Date(agora.getTime() - OFFSET_BRASILIA_MS + deslocamentoDias * UM_DIA_MS).toISOString().slice(0, 10)
}

/** "2026-10-29" → o valor da coluna date (meia-noite UTC desse dia). */
export function parseDataPernoite(texto: string): Date {
  return new Date(`${texto}T00:00:00.000Z`)
}

/** Coluna date → "29/10/2026 (qui)". */
export function formatarDataPernoite(data: Date | string): string {
  const d = new Date(data)
  const dia = new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC", day: "2-digit", month: "2-digit", year: "numeric" }).format(d)
  const semana = new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC", weekday: "short" }).format(d).replace(".", "")
  return `${dia} (${semana})`
}

/** Caminho público (sem login) da página de aprovação — fora do proxy de autenticação. */
export const CAMINHO_APROVACAO_HOTEL = "/aprovar-hotel"

type DadosMensagem = {
  motorista: string
  viagem: ViagemDoPedidoComFrota | null
  cidade: string
  nomeHotel: string
  dataPernoite: Date
  solicitante: string | null
  url: string
}

/** Texto que vai pronto pro grupo de WhatsApp da filial. */
export function montarMensagemHotel(d: DadosMensagem): string {
  return [
    "*Solicitação de hotel (pernoite)*",
    `Motorista: ${d.motorista}`,
    ...linhasDaViagem(d.viagem),
    `Cidade: ${d.cidade}`,
    `Pernoite: ${formatarDataPernoite(d.dataPernoite)}`,
    `Hotel: ${d.nomeHotel}`,
    ...(d.solicitante ? [`Pedido por: ${d.solicitante}`] : []),
    "",
    `Gestor, aprove ou recuse: ${d.url}`,
  ].join("\n")
}
