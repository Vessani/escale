"use client"

import { AcoesPedidoLink } from "@/components/aprovacao/acoes-pedido-link"
import { cancelarHotel, cancelarMeuHotel, reenviarLinkHotel, reenviarMeuLinkHotel } from "@/lib/actions/hotel"

/** Reenviar link / cancelar um pedido de hotel pendente. `doMotorista`: na área do motorista (actions que só mexem nos pedidos dele). */
export function AcoesHotel({ id, motorista, doMotorista = false }: { id: number; motorista: string; doMotorista?: boolean }) {
  return (
    <AcoesPedidoLink
      motorista={motorista}
      tipoPedido="hotel"
      reenviarLink={() => (doMotorista ? reenviarMeuLinkHotel(id) : reenviarLinkHotel(id))}
      cancelarPedido={() => (doMotorista ? cancelarMeuHotel(id) : cancelarHotel(id))}
    />
  )
}
