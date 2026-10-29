"use client"

import { useState } from "react"
import type { MotivoEstouro } from "@prisma/client"
import { Alert } from "@/components/ui/alert"
import { ControleSegmentado } from "@/components/ui/controle-segmentado"
import { pedirMeuEstouro, solicitarEstouro } from "@/lib/actions/estouro-jornada"
import {
  LIMITE_MINUTOS_ESTOURO,
  MAXIMO_MOTIVOS_ESTOURO,
  MOTIVOS_ESTOURO,
  OPCOES_MINUTOS_ESTOURO,
  formatarMinutos,
} from "@/lib/services/estouro-jornada-regras"
import {
  CamposMotoristaViagem,
  OpcaoMarcavel,
  PedidoRegistrado,
  RodapePedido,
  usePedidoLink,
  type ModoPedido,
  type ViagemDoPedido,
} from "@/components/aprovacao/form-pedido-link"

const OPCOES_HORAS = OPCOES_MINUTOS_ESTOURO.map((m) => ({ valor: String(m), rotulo: formatarMinutos(m) }))

/**
 * Pedido de estouro de jornada: horas extras e motivos. O resto (motorista,
 * viagem, envio, link do WhatsApp) é comum com o pedido de Uber — ver
 * form-pedido-link.tsx.
 */
export function FormEstouro({
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
  const [minutos, setMinutos] = useState<string | null>(null)
  const [motivos, setMotivos] = useState<MotivoEstouro[]>([])
  const { rotulo } = pedido.classes

  const completo = Boolean(pedido.temMotorista && minutos && motivos.length > 0)

  const alternarMotivo = (motivo: MotivoEstouro) =>
    setMotivos((atuais) =>
      atuais.includes(motivo) ? atuais.filter((m) => m !== motivo) : atuais.length < MAXIMO_MOTIVOS_ESTOURO ? [...atuais, motivo] : atuais,
    )

  const enviar = () =>
    pedido.enviar(({ motoristaId, viagemId }) => {
      const dados = { viagemId, minutosExtras: Number(minutos), motivos }
      return motoristaId === null ? pedirMeuEstouro(dados) : solicitarEstouro({ ...dados, motoristaId })
    })

  if (pedido.link) {
    return (
      <PedidoRegistrado pedido={pedido} link={pedido.link} voltarHref={voltarHref} resumo={`${formatarMinutos(Number(minutos))} extras.`} />
    )
  }

  return (
    <div className="space-y-4">
      {pedido.erro && <Alert variant="error">{pedido.erro}</Alert>}

      <CamposMotoristaViagem pedido={pedido} motoristas={motoristas} />

      <div className={rotulo}>
        Horas extras (até {formatarMinutos(LIMITE_MINUTOS_ESTOURO)})
        <ControleSegmentado rotulo="Horas extras" opcoes={OPCOES_HORAS} valor={minutos} onChange={setMinutos} largo />
      </div>

      <div className={rotulo}>
        <span className="flex justify-between">
          <span>Motivos (até {MAXIMO_MOTIVOS_ESTOURO})</span>
          <span className="tabular-nums">
            {motivos.length}/{MAXIMO_MOTIVOS_ESTOURO}
          </span>
        </span>
        <div role="group" aria-label="Motivos" className="grid gap-1 rounded-lg border bg-muted/40 p-1 sm:grid-cols-2">
          {MOTIVOS_ESTOURO.map((motivo) => {
            const marcado = motivos.includes(motivo.valor)
            return (
              <OpcaoMarcavel
                key={motivo.valor}
                marcado={marcado}
                bloqueado={!marcado && motivos.length >= MAXIMO_MOTIVOS_ESTOURO}
                grande={pedido.grande}
                onClick={() => alternarMotivo(motivo.valor)}
              >
                {motivo.rotulo}
              </OpcaoMarcavel>
            )
          })}
        </div>
      </div>

      <RodapePedido pedido={pedido} voltarHref={voltarHref} completo={completo} onEnviar={enviar} />
    </div>
  )
}
