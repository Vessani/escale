"use server"

import { headers } from "next/headers"
import { revalidatePath } from "next/cache"
import { errorToMessage } from "@/lib/action-error"
import { AREA_MOTORISTA } from "@/lib/papeis"
import { ipDaRequisicao } from "@/lib/services/login.service"
import { decidirUberPorToken } from "@/lib/services/uber.service"
import { CAMINHO_APROVACAO_UBER } from "@/lib/services/uber-regras"
import { esquemaDecisaoLink, type EntradaDecisaoLink } from "@/lib/validation/link-aprovacao"
import type { RespostaAcao } from "@/lib/types/types"

/**
 * Decisão do pedido de Uber pelo link do grupo de WhatsApp — sem sessão, de
 * propósito, como decidirEstouro (estouro-jornada-publico.ts). Quem autoriza
 * é o próprio token (256 bits, uso único, com validade). Não aceita nenhum
 * id: só o token, então não dá pra mexer em outro pedido a partir daqui.
 */
export async function decidirUber(dados: EntradaDecisaoLink): Promise<RespostaAcao> {
  try {
    const entrada = esquemaDecisaoLink.parse(dados)
    const ip = ipDaRequisicao(Object.fromEntries((await headers()).entries()))
    await decidirUberPorToken(entrada.token, entrada.decisao, { nome: entrada.nome, observacao: entrada.observacao, ip })
    revalidatePath(`${CAMINHO_APROVACAO_UBER}/${entrada.token}`)
    revalidatePath("/uber")
    revalidatePath(`${AREA_MOTORISTA}/uber`)
    return { sucesso: true }
  } catch (erro) {
    return { sucesso: false, erro: errorToMessage(erro, "Não foi possível registrar a decisão. Tente de novo.") }
  }
}
