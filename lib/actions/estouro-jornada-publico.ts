"use server"

import { headers } from "next/headers"
import { revalidatePath } from "next/cache"
import { errorToMessage } from "@/lib/action-error"
import { AREA_MOTORISTA } from "@/lib/papeis"
import { ipDaRequisicao } from "@/lib/services/login.service"
import { decidirEstouroPorToken } from "@/lib/services/estouro-jornada.service"
import { esquemaDecisaoEstouro } from "@/lib/validation/estouro-jornada"
import { CAMINHO_APROVACAO } from "@/lib/services/estouro-jornada-regras"
import type { RespostaAcao } from "@/lib/types/types"

/**
 * Decisão pelo link do grupo de WhatsApp — a ÚNICA action do sistema sem
 * sessão, de propósito. Quem autoriza é o próprio token (256 bits, uso
 * único, com validade); ver decidirEstouroPorToken. Não aceita nenhum id:
 * só o token, então não dá pra mexer em outro pedido a partir daqui.
 */
export async function decidirEstouro(dados: {
  token: string
  decisao: "APROVADO" | "RECUSADO"
  nome: string
  observacao?: string
}): Promise<RespostaAcao> {
  try {
    const entrada = esquemaDecisaoEstouro.parse(dados)
    const ip = ipDaRequisicao(Object.fromEntries((await headers()).entries()))
    await decidirEstouroPorToken(entrada.token, entrada.decisao, { nome: entrada.nome, observacao: entrada.observacao, ip })
    revalidatePath(`${CAMINHO_APROVACAO}/${entrada.token}`)
    revalidatePath("/estouros")
    revalidatePath(`${AREA_MOTORISTA}/estouro`)
    return { sucesso: true }
  } catch (erro) {
    return { sucesso: false, erro: errorToMessage(erro, "Não foi possível registrar a decisão. Tente de novo.") }
  }
}
