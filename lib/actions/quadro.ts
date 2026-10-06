"use server"
import { revalidatePath } from "next/cache"
import { requireSessionComFilial } from "@/lib/auth-guard"
import { errorToMessage } from "@/lib/action-error"
import type { RespostaAcao } from "@/lib/types/types"
import { z } from "@/lib/validation/zod"
import { atorDaSessao } from "@/lib/services/auditoria.service"
import { atualizarQuadroService } from "@/lib/services/quadro.service"

/** Recado do quadro do Dashboard — texto livre, mas não um documento. */
const TAMANHO_MAXIMO_QUADRO = 5000

/** Sobrescreve o texto do quadro de observações da filial. */
export async function atualizarObservacoes(texto: string): Promise<RespostaAcao> {
  try {
    const { session, filialId } = await requireSessionComFilial()
    const textoValidado = z.string().max(TAMANHO_MAXIMO_QUADRO, `O quadro aceita até ${TAMANHO_MAXIMO_QUADRO} caracteres.`).parse(texto)
    await atualizarQuadroService(filialId, textoValidado, atorDaSessao(session))
    revalidatePath("/")
    return { sucesso: true }
  } catch (erro) {
    return { sucesso: false, erro: errorToMessage(erro, "Não foi possível salvar as observações.") }
  }
}
