/**
 * Regras do estouro de jornada sem banco nem Node — usadas no servidor e na
 * tela (montar o link do WhatsApp, mostrar "2h30", decidir se o link já
 * expirou). O que mexe no banco fica em estouro-jornada.service.ts.
 */
import type { MotivoEstouro, StatusEstouro } from "@prisma/client"

/**
 * Teto do pedido: 2h, o que a Lei 13.103/2015 (Lei do Motorista) permite
 * prorrogar a jornada sem convenção coletiva dizendo outra coisa — e o
 * limite que a Ritmo usa.
 */
export const LIMITE_MINUTOS_ESTOURO = 120

/** Passo das opções do formulário (0h30, 1h00, 1h30...). */
export const PASSO_MINUTOS_ESTOURO = 30

/** Por quanto tempo o link vale. Passou disso, gera-se outro. */
export const VALIDADE_LINK_HORAS = 12

/** Quantos motivos o pedido pode marcar. */
export const MAXIMO_MOTIVOS_ESTOURO = 3

/** Os motivos que dá pra escolher, na ordem da tela. Pra mudar a lista: enum MotivoEstouro no schema + aqui. */
export const MOTIVOS_ESTOURO: ReadonlyArray<{ valor: MotivoEstouro; rotulo: string }> = [
  { valor: "CLIENTE_PRIORITARIO", rotulo: "Cliente prioritário" },
  { valor: "TRANSITO_LENTO", rotulo: "Trânsito lento" },
  { valor: "CHEGAR_HOTEL", rotulo: "Chegar no hotel" },
  { valor: "CHEGAR_CLIENTE", rotulo: "Chegar no cliente" },
  { valor: "CHEGAR_CDL", rotulo: "Chegar ao CDL" },
  { valor: "ABASTECER", rotulo: "Abastecer" },
]

const ROTULO_MOTIVO = Object.fromEntries(MOTIVOS_ESTOURO.map((m) => [m.valor, m.rotulo])) as Record<MotivoEstouro, string>

/** ["TRANSITO_LENTO", "ABASTECER"] → "Trânsito lento, Abastecer" (na ordem da lista, não na do clique). */
export function formatarMotivos(motivos: readonly MotivoEstouro[]): string {
  return MOTIVOS_ESTOURO.filter((m) => motivos.includes(m.valor))
    .map((m) => ROTULO_MOTIVO[m.valor])
    .join(", ")
}

export const TAMANHO_MAXIMO_OBSERVACAO_GESTOR = 300
export const TAMANHO_MAXIMO_NOME_DECISOR = 80

/** Caminho público (sem login) da página de aprovação — fora do proxy de autenticação. */
export const CAMINHO_APROVACAO = "/aprovar-estouro"

export const OPCOES_MINUTOS_ESTOURO: number[] = Array.from(
  { length: LIMITE_MINUTOS_ESTOURO / PASSO_MINUTOS_ESTOURO },
  (_, i) => (i + 1) * PASSO_MINUTOS_ESTOURO,
)

/** 150 → "2h30", 120 → "2h", 30 → "30min". */
export function formatarMinutos(minutos: number): string {
  const horas = Math.floor(minutos / 60)
  const resto = minutos % 60
  if (horas === 0) return `${resto}min`
  return resto === 0 ? `${horas}h` : `${horas}h${String(resto).padStart(2, "0")}`
}

type SituacaoEstouro = StatusEstouro | "EXPIRADO"

/** Status pra mostrar: pendente com link vencido aparece como expirado. */
export function situacaoDoEstouro(estouro: { status: StatusEstouro; expiraEm: Date }, agora = new Date()): SituacaoEstouro {
  if (estouro.status === "PENDENTE" && estouro.expiraEm.getTime() <= agora.getTime()) return "EXPIRADO"
  return estouro.status
}

export const ROTULO_SITUACAO: Record<SituacaoEstouro, string> = {
  PENDENTE: "Aguardando gestor",
  APROVADO: "Aprovado",
  RECUSADO: "Recusado",
  CANCELADO: "Cancelado",
  EXPIRADO: "Link expirado",
}

/** Badge outline com a paleta sutil das outras telas (ver CLASSE_SITUACAO em app/frotas/manutencoes/page.tsx). */
export const CLASSE_SITUACAO: Record<SituacaoEstouro, string> = {
  PENDENTE: "border-warning/30 bg-warning/10 text-warning",
  APROVADO: "border-success/30 bg-success/10 text-success",
  RECUSADO: "border-destructive/30 bg-destructive/10 text-destructive",
  CANCELADO: "border-border bg-muted text-muted-foreground",
  EXPIRADO: "border-border bg-muted text-muted-foreground",
}

type DadosMensagem = {
  motorista: string
  numViagem: string | null
  minutosExtras: number
  motivos: readonly MotivoEstouro[]
  solicitante: string | null
  url: string
}

/** Texto que vai pronto pro grupo de WhatsApp da filial. */
export function montarMensagemWhatsApp(d: DadosMensagem): string {
  return [
    "*Solicitação de estouro de jornada*",
    `Motorista: ${d.motorista}`,
    ...(d.numViagem ? [`Viagem: ${d.numViagem}`] : []),
    `Horas extras: ${formatarMinutos(d.minutosExtras)}`,
    `Motivo: ${formatarMotivos(d.motivos)}`,
    ...(d.solicitante ? [`Pedido por: ${d.solicitante}`] : []),
    "",
    `Gestor, aprove ou recuse: ${d.url}`,
  ].join("\n")
}

/**
 * Link de compartilhamento do WhatsApp (gratuito, sem API). Sem número:
 * o wa.me não abre grupo direto, então o WhatsApp mostra as conversas e a
 * pessoa escolhe o grupo da filial.
 */
export function montarLinkWhatsApp(mensagem: string): string {
  return `https://wa.me/?text=${encodeURIComponent(mensagem)}`
}
