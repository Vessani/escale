"use server"

import { requireSessaoMotorista, requireSessionComFilial } from "@/lib/auth-guard"
import { actionsDePedidoLink } from "@/lib/actions/pedido-link"
import { atorDaSessao } from "@/lib/services/auditoria.service"
import { AREA_MOTORISTA, PAPEIS_ESCALADOR } from "@/lib/papeis"
import { cancelarSolicitacaoUber, criarSolicitacaoUber, gerarNovoLinkUber } from "@/lib/services/uber.service"
import type { RespostaLink } from "@/lib/services/link-aprovacao"
import { esquemaUberEscalador, esquemaUberMotorista, type EntradaUberEscalador, type EntradaUberMotorista } from "@/lib/validation/uber"
import { z } from "@/lib/validation/zod"
import type { RespostaAcao } from "@/lib/types/types"

const id = z.number().int().positive()

/** O pedido aparece nas duas telas: a lista do escalador e a do motorista. */
const { comLink, semRetorno } = actionsDePedidoLink(["/uber", `${AREA_MOTORISTA}/uber`])

// ------------------------------------------------------------ escalador

/** Escalador pede o Uber; volta o link do WhatsApp pra postar no grupo. */
export async function solicitarUber(dados: EntradaUberEscalador): Promise<RespostaLink> {
  return comLink(async () => {
    const { session, filialId } = await requireSessionComFilial(PAPEIS_ESCALADOR)
    return criarSolicitacaoUber(filialId, esquemaUberEscalador.parse(dados), atorDaSessao(session))
  }, "Não foi possível registrar o pedido de Uber.")
}

export async function reenviarLinkUber(pedidoId: number): Promise<RespostaLink> {
  return comLink(async () => {
    const { session, filialId } = await requireSessionComFilial(PAPEIS_ESCALADOR)
    return gerarNovoLinkUber(filialId, id.parse(pedidoId), atorDaSessao(session))
  }, "Não foi possível gerar um novo link.")
}

export async function cancelarUber(pedidoId: number): Promise<RespostaAcao> {
  return semRetorno(async () => {
    const { session, filialId } = await requireSessionComFilial(PAPEIS_ESCALADOR)
    await cancelarSolicitacaoUber(filialId, id.parse(pedidoId), atorDaSessao(session))
  }, "Não foi possível cancelar o pedido.")
}

// ------------------------------------------------------------ motorista
// O motorista vem sempre da sessão: ele só pede e mexe nos pedidos dele.

export async function pedirMeuUber(dados: EntradaUberMotorista): Promise<RespostaLink> {
  return comLink(async () => {
    const { session, filialId, motoristaId } = await requireSessaoMotorista()
    const entrada = esquemaUberMotorista.parse(dados)
    return criarSolicitacaoUber(filialId, { ...entrada, motoristaId }, atorDaSessao(session), { pedidoPeloMotorista: true })
  }, "Não foi possível registrar o pedido de Uber.")
}

export async function reenviarMeuLinkUber(pedidoId: number): Promise<RespostaLink> {
  return comLink(async () => {
    const { session, filialId, motoristaId } = await requireSessaoMotorista()
    return gerarNovoLinkUber(filialId, id.parse(pedidoId), atorDaSessao(session), { doMotorista: motoristaId })
  }, "Não foi possível gerar um novo link.")
}

export async function cancelarMeuUber(pedidoId: number): Promise<RespostaAcao> {
  return semRetorno(async () => {
    const { session, filialId, motoristaId } = await requireSessaoMotorista()
    await cancelarSolicitacaoUber(filialId, id.parse(pedidoId), atorDaSessao(session), { doMotorista: motoristaId })
  }, "Não foi possível cancelar o pedido.")
}
