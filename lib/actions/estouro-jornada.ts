"use server"

import { revalidatePath } from "next/cache"
import { requireSessaoMotorista, requireSessionComFilial } from "@/lib/auth-guard"
import { errorToMessage } from "@/lib/action-error"
import { atorDaSessao } from "@/lib/services/auditoria.service"
import { AREA_MOTORISTA, PAPEIS_ESCALADOR } from "@/lib/papeis"
import {
  cancelarSolicitacaoEstouro,
  criarSolicitacaoEstouro,
  gerarNovoLinkEstouro,
  type LinkGerado,
} from "@/lib/services/estouro-jornada.service"
import {
  esquemaSolicitacaoEstouro,
  esquemaSolicitacaoMotorista,
  type EntradaSolicitacaoEstouro,
  type EntradaSolicitacaoMotorista,
} from "@/lib/validation/estouro-jornada"
import { z } from "@/lib/validation/zod"
import type { RespostaAcao } from "@/lib/types/types"

type RespostaLink = { sucesso: true; link: LinkGerado } | { sucesso: false; erro: string }

const id = z.number().int().positive()

/** O pedido aparece nas duas telas: a lista do escalador e a do motorista. */
function revalidarTelas() {
  revalidatePath("/estouros")
  revalidatePath(`${AREA_MOTORISTA}/estouro`)
}

async function comLink(acao: () => Promise<LinkGerado>, fallback: string): Promise<RespostaLink> {
  try {
    const link = await acao()
    revalidarTelas()
    return { sucesso: true, link }
  } catch (erro) {
    return { sucesso: false, erro: errorToMessage(erro, fallback) }
  }
}

async function semRetorno(acao: () => Promise<unknown>, fallback: string): Promise<RespostaAcao> {
  try {
    await acao()
    revalidarTelas()
    return { sucesso: true }
  } catch (erro) {
    return { sucesso: false, erro: errorToMessage(erro, fallback) }
  }
}

// ------------------------------------------------------------ escalador

/** Escalador pede o estouro; volta o link do WhatsApp pra postar no grupo. */
export async function solicitarEstouro(dados: EntradaSolicitacaoEstouro): Promise<RespostaLink> {
  return comLink(async () => {
    const { session, filialId } = await requireSessionComFilial(PAPEIS_ESCALADOR)
    return criarSolicitacaoEstouro(filialId, esquemaSolicitacaoEstouro.parse(dados), atorDaSessao(session))
  }, "Não foi possível registrar o pedido de estouro.")
}

export async function reenviarLinkEstouro(estouroId: number): Promise<RespostaLink> {
  return comLink(async () => {
    const { session, filialId } = await requireSessionComFilial(PAPEIS_ESCALADOR)
    return gerarNovoLinkEstouro(filialId, id.parse(estouroId), atorDaSessao(session))
  }, "Não foi possível gerar um novo link.")
}

export async function cancelarEstouro(estouroId: number): Promise<RespostaAcao> {
  return semRetorno(async () => {
    const { session, filialId } = await requireSessionComFilial(PAPEIS_ESCALADOR)
    await cancelarSolicitacaoEstouro(filialId, id.parse(estouroId), atorDaSessao(session))
  }, "Não foi possível cancelar o pedido.")
}

// ------------------------------------------------------------ motorista
// O motorista vem sempre da sessão: ele só pede e mexe nos pedidos dele.

export async function pedirMeuEstouro(dados: EntradaSolicitacaoMotorista): Promise<RespostaLink> {
  return comLink(async () => {
    const { session, filialId, motoristaId } = await requireSessaoMotorista()
    const entrada = esquemaSolicitacaoMotorista.parse(dados)
    return criarSolicitacaoEstouro(filialId, { ...entrada, motoristaId }, atorDaSessao(session), { pedidoPeloMotorista: true })
  }, "Não foi possível registrar o pedido de estouro.")
}

export async function reenviarMeuLinkEstouro(estouroId: number): Promise<RespostaLink> {
  return comLink(async () => {
    const { session, filialId, motoristaId } = await requireSessaoMotorista()
    return gerarNovoLinkEstouro(filialId, id.parse(estouroId), atorDaSessao(session), { doMotorista: motoristaId })
  }, "Não foi possível gerar um novo link.")
}

export async function cancelarMeuEstouro(estouroId: number): Promise<RespostaAcao> {
  return semRetorno(async () => {
    const { session, filialId, motoristaId } = await requireSessaoMotorista()
    await cancelarSolicitacaoEstouro(filialId, id.parse(estouroId), atorDaSessao(session), { doMotorista: motoristaId })
  }, "Não foi possível cancelar o pedido.")
}
