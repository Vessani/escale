"use client"

import { useState } from "react"
import type { MotivoUber } from "@prisma/client"
import { Alert } from "@/components/ui/alert"
import { pedirMeuUber, solicitarUber } from "@/lib/actions/uber"
import { MOTIVOS_UBER, TAMANHO_MAXIMO_LOCAL_UBER, formatarMotivoUber } from "@/lib/services/uber-regras"
import {
  CamposMotoristaViagem,
  OpcaoMarcavel,
  PedidoRegistrado,
  RodapePedido,
  usePedidoLink,
  type ModoPedido,
  type ViagemDoPedido,
} from "@/components/aprovacao/form-pedido-link"

/**
 * Pedido de Uber: origem, destino e motivo. O resto (motorista, viagem,
 * envio, link do WhatsApp) é comum com o pedido de estouro — ver
 * form-pedido-link.tsx.
 */
export function FormUber({
  modo,
  viagens,
  motoristas = [],
  viagemInicial,
  voltarHref,
}: {
  modo: ModoPedido
  viagens: ViagemDoPedido[]
  motoristas?: Array<{ id: number; nome: string }>
  viagemInicial?: number
  voltarHref: string
}) {
  const pedido = usePedidoLink({ modo, viagens, motoristas, viagemInicial })
  const [origem, setOrigem] = useState("")
  const [destino, setDestino] = useState("")
  const [motivo, setMotivo] = useState<MotivoUber | null>(null)
  const { campo, rotulo, linha } = pedido.classes

  const completo = Boolean(pedido.temMotorista && origem.trim().length >= 3 && destino.trim().length >= 3 && motivo)

  const enviar = () => {
    if (!motivo) return
    pedido.enviar(({ motoristaId, viagemId }) => {
      const dados = { viagemId, origem, destino, motivo }
      return motoristaId === null ? pedirMeuUber(dados) : solicitarUber({ ...dados, motoristaId })
    })
  }

  if (pedido.link) {
    return (
      <PedidoRegistrado
        pedido={pedido}
        link={pedido.link}
        voltarHref={voltarHref}
        resumo={`${motivo ? `${formatarMotivoUber(motivo)}: ` : ""}${origem.trim()} → ${destino.trim()}.`}
      />
    )
  }

  return (
    <div className="space-y-4">
      {pedido.erro && <Alert variant="error">{pedido.erro}</Alert>}

      <CamposMotoristaViagem pedido={pedido} motoristas={motoristas} />

      <div className={linha}>
        <label className={rotulo}>
          Origem
          <input
            value={origem}
            onChange={(e) => setOrigem(e.target.value)}
            maxLength={TAMANHO_MAXIMO_LOCAL_UBER}
            placeholder="Ex: Posto Graal, km 120 da BR-101"
            className={campo}
          />
        </label>
        <label className={rotulo}>
          Destino
          <input
            value={destino}
            onChange={(e) => setDestino(e.target.value)}
            maxLength={TAMANHO_MAXIMO_LOCAL_UBER}
            placeholder="Ex: Hotel Ibis, Joinville"
            className={campo}
          />
        </label>
      </div>

      <div className={rotulo}>
        Motivo
        {/* Mesma grade dos motivos do estouro, mas escolhe um só. */}
        <div role="group" aria-label="Motivo" className="grid grid-cols-2 gap-1 rounded-lg border bg-muted/40 p-1">
          {MOTIVOS_UBER.map((opcao) => (
            <OpcaoMarcavel key={opcao.valor} marcado={motivo === opcao.valor} grande={pedido.grande} onClick={() => setMotivo(opcao.valor)}>
              {opcao.rotulo}
            </OpcaoMarcavel>
          ))}
        </div>
      </div>

      <RodapePedido pedido={pedido} voltarHref={voltarHref} completo={completo} onEnviar={enviar} />
    </div>
  )
}
