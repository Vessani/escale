"use server"

import { requireSessaoMotorista, requireSessionComFilial } from "@/lib/auth-guard"
import { actionsDePedidoLink } from "@/lib/actions/pedido-link"
import { atorDaSessao } from "@/lib/services/auditoria.service"
import { AREA_MOTORISTA, PAPEIS_ESCALADOR } from "@/lib/papeis"
import { cancelarSolicitacaoHotel, criarSolicitacaoHotel, gerarNovoLinkHotel } from "@/lib/services/hotel.service"
import type { RespostaLink } from "@/lib/services/link-aprovacao"
import {
  esquemaHotelEscalador,
  esquemaHotelMotorista,
  type EntradaHotelEscalador,
  type EntradaHotelMotorista,
} from "@/lib/validation/hotel"
import { z } from "@/lib/validation/zod"
import type { RespostaAcao } from "@/lib/types/types"

const id = z.number().int().positive()

/** O pedido aparece nas duas telas: a lista do escalador e a do motorista. */
const { comLink, semRetorno } = actionsDePedidoLink(["/hotel", `${AREA_MOTORISTA}/hotel`])

// ------------------------------------------------------------ escalador

/** Escalador pede o hotel; volta o link do WhatsApp pra postar no grupo. */
export async function solicitarHotel(dados: EntradaHotelEscalador): Promise<RespostaLink> {
  return comLink(async () => {
    const { session, filialId } = await requireSessionComFilial(PAPEIS_ESCALADOR)
    return criarSolicitacaoHotel(filialId, esquemaHotelEscalador.parse(dados), atorDaSessao(session))
  }, "Não foi possível registrar o pedido de hotel.")
}

export async function reenviarLinkHotel(pedidoId: number): Promise<RespostaLink> {
  return comLink(async () => {
    const { session, filialId } = await requireSessionComFilial(PAPEIS_ESCALADOR)
    return gerarNovoLinkHotel(filialId, id.parse(pedidoId), atorDaSessao(session))
  }, "Não foi possível gerar um novo link.")
}

export async function cancelarHotel(pedidoId: number): Promise<RespostaAcao> {
  return semRetorno(async () => {
    const { session, filialId } = await requireSessionComFilial(PAPEIS_ESCALADOR)
    await cancelarSolicitacaoHotel(filialId, id.parse(pedidoId), atorDaSessao(session))
  }, "Não foi possível cancelar o pedido.")
}

// ------------------------------------------------------------ motorista
// O motorista vem sempre da sessão: ele só pede e mexe nos pedidos dele.

export async function pedirMeuHotel(dados: EntradaHotelMotorista): Promise<RespostaLink> {
  return comLink(async () => {
    const { session, filialId, motoristaId } = await requireSessaoMotorista()
    const entrada = esquemaHotelMotorista.parse(dados)
    return criarSolicitacaoHotel(filialId, { ...entrada, motoristaId }, atorDaSessao(session), { pedidoPeloMotorista: true })
  }, "Não foi possível registrar o pedido de hotel.")
}

export async function reenviarMeuLinkHotel(pedidoId: number): Promise<RespostaLink> {
  return comLink(async () => {
    const { session, filialId, motoristaId } = await requireSessaoMotorista()
    return gerarNovoLinkHotel(filialId, id.parse(pedidoId), atorDaSessao(session), { doMotorista: motoristaId })
  }, "Não foi possível gerar um novo link.")
}

export async function cancelarMeuHotel(pedidoId: number): Promise<RespostaAcao> {
  return semRetorno(async () => {
    const { session, filialId, motoristaId } = await requireSessaoMotorista()
    await cancelarSolicitacaoHotel(filialId, id.parse(pedidoId), atorDaSessao(session), { doMotorista: motoristaId })
  }, "Não foi possível cancelar o pedido.")
}
