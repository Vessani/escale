/**
 * Entrega com chegada registrada pelo motorista (km, hora e medição do
 * descarregado) não pode mudar de cliente/lugar numa edição da viagem: a
 * medição ficaria ligada a um cliente onde ela não aconteceu (e iria assim
 * pro relatório). Pra corrigir, o escalador apaga a chegada primeiro (fica
 * no histórico) e aí edita a entrega.
 */

const CAMPOS_TRAVADOS_COM_CHEGADA = {
  cliente: "cliente",
  cidade: "cidade",
  uf: "UF",
  sapcode: "SAP code",
  codewhite: "número white",
} as const

type CampoTravado = keyof typeof CAMPOS_TRAVADOS_COM_CHEGADA
type DadosTravados = Record<CampoTravado, string | null | undefined>

const normalizar = (valor: string | null | undefined) => (valor ?? "").trim().toUpperCase()

/** Rótulos dos campos travados que a edição mudou (vazio = pode gravar). */
export function camposTravadosAlterados(atual: DadosTravados, editada: DadosTravados): string[] {
  return (Object.keys(CAMPOS_TRAVADOS_COM_CHEGADA) as CampoTravado[])
    .filter((campo) => normalizar(atual[campo]) !== normalizar(editada[campo]))
    .map((campo) => CAMPOS_TRAVADOS_COM_CHEGADA[campo])
}
