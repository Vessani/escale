"use client"

import { AcoesPedidoLink } from "@/components/aprovacao/acoes-pedido-link"
import { cancelarMeuUber, cancelarUber, reenviarLinkUber, reenviarMeuLinkUber } from "@/lib/actions/uber"

/** Reenviar link / cancelar um pedido de Uber pendente. `doMotorista`: na área do motorista (actions que só mexem nos pedidos dele). */
export function AcoesUber({ id, motorista, doMotorista = false }: { id: number; motorista: string; doMotorista?: boolean }) {
  return (
    <AcoesPedidoLink
      motorista={motorista}
      tipoPedido="Uber"
      reenviarLink={() => (doMotorista ? reenviarMeuLinkUber(id) : reenviarLinkUber(id))}
      cancelarPedido={() => (doMotorista ? cancelarMeuUber(id) : cancelarUber(id))}
    />
  )
}
