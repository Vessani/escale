/**
 * Regras do pedido de Uber sem banco nem Node — usadas no servidor e na tela.
 * O que mexe no banco fica em uber.service.ts; o que é comum a todo pedido
 * por link (validade, situação, wa.me), em link-aprovacao-regras.ts.
 */
import type { MotivoUber } from "@prisma/client"
import { linhasDaViagem, type ViagemDoPedidoComFrota } from "@/lib/services/link-aprovacao-regras"

/** Origem e destino são texto livre (endereço, posto, cidade) — limite da coluna. */
export const TAMANHO_MAXIMO_LOCAL_UBER = 150

/** Os motivos que dá pra escolher, na ordem da tela. Pra mudar a lista: enum MotivoUber no schema + aqui. */
export const MOTIVOS_UBER: ReadonlyArray<{ valor: MotivoUber; rotulo: string }> = [
  { valor: "PERNOITE", rotulo: "Pernoite" },
  { valor: "MANUTENCAO", rotulo: "Manutenção" },
  { valor: "BUSCAR_FROTA", rotulo: "Buscar frota" },
  { valor: "RENDER_MOTORISTA", rotulo: "Render motorista" },
]

const ROTULO_MOTIVO = Object.fromEntries(MOTIVOS_UBER.map((m) => [m.valor, m.rotulo])) as Record<MotivoUber, string>

export function formatarMotivoUber(motivo: MotivoUber): string {
  return ROTULO_MOTIVO[motivo]
}

/** Caminho público (sem login) da página de aprovação — fora do proxy de autenticação. */
export const CAMINHO_APROVACAO_UBER = "/aprovar-uber"

type DadosMensagem = {
  motorista: string
  viagem: ViagemDoPedidoComFrota | null
  origem: string
  destino: string
  motivo: MotivoUber
  solicitante: string | null
  url: string
}

/** Texto que vai pronto pro grupo de WhatsApp da filial. */
export function montarMensagemUber(d: DadosMensagem): string {
  return [
    "*Solicitação de Uber*",
    `Motorista: ${d.motorista}`,
    ...linhasDaViagem(d.viagem),
    `Origem: ${d.origem}`,
    `Destino: ${d.destino}`,
    `Motivo: ${formatarMotivoUber(d.motivo)}`,
    ...(d.solicitante ? [`Pedido por: ${d.solicitante}`] : []),
    "",
    `Gestor, aprove ou recuse: ${d.url}`,
  ].join("\n")
}
