"use client"

import { useState } from "react"
import { Alert } from "@/components/ui/alert"
import { pedirMeuHotel, solicitarHotel } from "@/lib/actions/hotel"
import {
  DIAS_MAXIMOS_ANTECEDENCIA_HOTEL,
  TAMANHO_MAXIMO_CIDADE_HOTEL,
  TAMANHO_MAXIMO_NOME_HOTEL,
  diaEmBrasilia,
  formatarDataPernoite,
  parseDataPernoite,
} from "@/lib/services/hotel-regras"
import {
  CamposMotoristaViagem,
  PedidoRegistrado,
  RodapePedido,
  usePedidoLink,
  type ModoPedido,
  type ViagemDoPedido,
} from "@/components/aprovacao/form-pedido-link"

/**
 * Pedido de hotel pro pernoite: cidade, data e nome do hotel. O resto (motorista,
 * viagem, envio, link do WhatsApp) é comum com os pedidos de Uber e de
 * estouro — ver form-pedido-link.tsx.
 */
export function FormHotel({
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
  const [cidade, setCidade] = useState("")
  const [nomeHotel, setNomeHotel] = useState("")
  // Hoje por padrão: o mais comum é pedir o hotel do dia. O intervalo aceito vem das mesmas regras do service.
  const [hoje] = useState(() => new Date())
  const [dataPernoite, setDataPernoite] = useState(() => diaEmBrasilia(hoje))
  const { campo, rotulo, linha } = pedido.classes

  const completo = Boolean(pedido.temMotorista && cidade.trim().length >= 2 && nomeHotel.trim().length >= 2 && dataPernoite !== "")

  const enviar = () =>
    pedido.enviar(({ motoristaId, viagemId }) => {
      const dados = { viagemId, cidade, nomeHotel, dataPernoite }
      return motoristaId === null ? pedirMeuHotel(dados) : solicitarHotel({ ...dados, motoristaId })
    })

  if (pedido.link) {
    return (
      <PedidoRegistrado
        pedido={pedido}
        link={pedido.link}
        voltarHref={voltarHref}
        resumo={`${nomeHotel.trim()} em ${cidade.trim()}, ${formatarDataPernoite(parseDataPernoite(dataPernoite))}.`}
      />
    )
  }

  return (
    <div className="space-y-4">
      {pedido.erro && <Alert variant="error">{pedido.erro}</Alert>}

      <CamposMotoristaViagem pedido={pedido} motoristas={motoristas} />

      <div className={linha}>
        <label className={rotulo}>
          Cidade do pernoite
          <input
            value={cidade}
            onChange={(e) => setCidade(e.target.value)}
            maxLength={TAMANHO_MAXIMO_CIDADE_HOTEL}
            placeholder="Ex: Curitiba"
            autoComplete="address-level2"
            className={campo}
          />
        </label>
        <label className={rotulo}>
          Data do pernoite
          <input
            type="date"
            value={dataPernoite}
            onChange={(e) => setDataPernoite(e.target.value)}
            min={diaEmBrasilia(hoje, -1)}
            max={diaEmBrasilia(hoje, DIAS_MAXIMOS_ANTECEDENCIA_HOTEL)}
            className={campo}
          />
        </label>
      </div>

      <div className={linha}>
        <label className={rotulo}>
          Nome do hotel
          <input
            value={nomeHotel}
            onChange={(e) => setNomeHotel(e.target.value)}
            maxLength={TAMANHO_MAXIMO_NOME_HOTEL}
            placeholder="Ex: Hotel Ibis Centro"
            className={campo}
          />
        </label>
      </div>

      <RodapePedido pedido={pedido} voltarHref={voltarHref} completo={completo} onEnviar={enviar} />
    </div>
  )
}
