/**
 * Regras do pedido de hotel sem banco nem Node — usadas no servidor e na tela.
 * O que mexe no banco fica em hotel.service.ts; o que é comum a todo pedido
 * por link (validade, situação, wa.me), em link-aprovacao-regras.ts.
 */

/** Cidade do pernoite e nome do hotel são texto livre — limites das colunas. */
export const TAMANHO_MAXIMO_CIDADE_HOTEL = 100
export const TAMANHO_MAXIMO_NOME_HOTEL = 150

/** Caminho público (sem login) da página de aprovação — fora do proxy de autenticação. */
export const CAMINHO_APROVACAO_HOTEL = "/aprovar-hotel"

type DadosMensagem = {
  motorista: string
  numViagem: string | null
  cidade: string
  nomeHotel: string
  solicitante: string | null
  url: string
}

/** Texto que vai pronto pro grupo de WhatsApp da filial. */
export function montarMensagemHotel(d: DadosMensagem): string {
  return [
    "*Solicitação de hotel (pernoite)*",
    `Motorista: ${d.motorista}`,
    ...(d.numViagem ? [`Viagem: ${d.numViagem}`] : []),
    `Cidade: ${d.cidade}`,
    `Hotel: ${d.nomeHotel}`,
    ...(d.solicitante ? [`Pedido por: ${d.solicitante}`] : []),
    "",
    `Gestor, aprove ou recuse: ${d.url}`,
  ].join("\n")
}
