/**
 * Regras comuns dos pedidos aprovados por link no grupo de WhatsApp da filial
 * (estouro de jornada, Uber, hotel) — sem banco nem Node, usadas no servidor e na
 * tela. O que gera token e mexe no banco fica em link-aprovacao.ts; o que é
 * de cada tipo de pedido (campos, motivos, texto da mensagem), no arquivo de
 * regras dele.
 */

import type { StatusViagem } from "@prisma/client"
import { frotaEhValida } from "@/lib/services/frota-regras"
import { STATUS_EM_ANDAMENTO } from "@/lib/services/viagem-status.service"

/** Por quanto tempo o link vale. Passou disso, gera-se outro. */
export const VALIDADE_LINK_HORAS = 12

export const TAMANHO_MAXIMO_OBSERVACAO_GESTOR = 300
export const TAMANHO_MAXIMO_NOME_DECISOR = 80

/** Os status gravados (enum StatusEstouro / StatusUber no schema — mesmos valores). */
type StatusPedidoLink = "PENDENTE" | "APROVADO" | "RECUSADO" | "CANCELADO"

/** "Expirado" não é status: é PENDENTE com expiraEm no passado — sem rotina agendada pra virar o status. */
export type SituacaoPedido = StatusPedidoLink | "EXPIRADO"

/** Status pra mostrar: pendente com link vencido aparece como expirado. */
export function situacaoDoPedido(pedido: { status: StatusPedidoLink; expiraEm: Date }, agora = new Date()): SituacaoPedido {
  if (pedido.status === "PENDENTE" && pedido.expiraEm.getTime() <= agora.getTime()) return "EXPIRADO"
  return pedido.status
}

export const ROTULO_SITUACAO: Record<SituacaoPedido, string> = {
  PENDENTE: "Aguardando gestor",
  APROVADO: "Aprovado",
  RECUSADO: "Recusado",
  CANCELADO: "Cancelado",
  EXPIRADO: "Link expirado",
}

/** Badge outline com a paleta sutil das outras telas (ver CLASSE_SITUACAO em app/frotas/manutencoes/page.tsx). */
export const CLASSE_SITUACAO: Record<SituacaoPedido, string> = {
  PENDENTE: "border-warning/30 bg-warning/10 text-warning",
  APROVADO: "border-success/30 bg-success/10 text-success",
  RECUSADO: "border-destructive/30 bg-destructive/10 text-destructive",
  CANCELADO: "border-border bg-muted text-muted-foreground",
  EXPIRADO: "border-border bg-muted text-muted-foreground",
}

/**
 * Link de compartilhamento do WhatsApp (gratuito, sem API). Sem número:
 * o wa.me não abre grupo direto, então o WhatsApp mostra as conversas e a
 * pessoa escolhe o grupo da filial.
 */
export function montarLinkWhatsApp(mensagem: string): string {
  return `https://wa.me/?text=${encodeURIComponent(mensagem)}`
}

/** A viagem ligada ao pedido, como vai pro grupo e pras telas. */
export type ViagemDoPedidoComFrota = { numViagem: string; cavalo: string; carreta: string }

/** "ABC1D23 / DEF4G56" — só os códigos válidos (truck sem cavalo separado vem "0000"); null se nenhum. */
export function frotaDaViagem(viagem: { cavalo: string; carreta: string }): string | null {
  const codigos = [viagem.cavalo, viagem.carreta].filter(frotaEhValida)
  return codigos.length > 0 ? codigos.join(" / ") : null
}

/**
 * Linha da viagem na mensagem do grupo: "Viagem: 12345 · Frota ABC1D23 / DEF4G56".
 * Sem viagem, nenhuma linha — o pedido pode não estar ligado a uma viagem.
 */
export function linhasDaViagem(viagem: ViagemDoPedidoComFrota | null): string[] {
  if (!viagem) return []
  const frota = frotaDaViagem(viagem)
  return [`Viagem: ${viagem.numViagem}${frota ? ` · Frota ${frota}` : ""}`]
}

/**
 * Qual viagem já vem marcada no pedido: a que o motorista está fazendo agora
 * (iniciada ou retornando), se houver só uma; senão, a única aberta dele.
 * Com mais de uma possível, nenhuma — quem pede escolhe.
 */
export function viagemSugerida<V extends { id: number; status: StatusViagem }>(viagensDoMotorista: readonly V[]): V | null {
  const naEstrada = viagensDoMotorista.filter((v) => STATUS_EM_ANDAMENTO.includes(v.status))
  if (naEstrada.length === 1) return naEstrada[0]
  if (naEstrada.length === 0 && viagensDoMotorista.length === 1) return viagensDoMotorista[0]
  return null
}
