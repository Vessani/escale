"use client"

import { AcoesPedidoLink } from "@/components/aprovacao/acoes-pedido-link"
import { cancelarEstouro, cancelarMeuEstouro, reenviarLinkEstouro, reenviarMeuLinkEstouro } from "@/lib/actions/estouro-jornada"

/** Reenviar link / cancelar um estouro pendente. `doMotorista`: na área do motorista (actions que só mexem nos pedidos dele). */
export function AcoesEstouro({ id, motorista, doMotorista = false }: { id: number; motorista: string; doMotorista?: boolean }) {
  return (
    <AcoesPedidoLink
      motorista={motorista}
      tipoPedido="estouro"
      reenviarLink={() => (doMotorista ? reenviarMeuLinkEstouro(id) : reenviarLinkEstouro(id))}
      cancelarPedido={() => (doMotorista ? cancelarMeuEstouro(id) : cancelarEstouro(id))}
    />
  )
}
