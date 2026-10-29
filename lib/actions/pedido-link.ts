import { revalidatePath } from "next/cache"
import { errorToMessage } from "@/lib/action-error"
import type { LinkGerado, RespostaLink } from "@/lib/services/link-aprovacao"
import type { RespostaAcao } from "@/lib/types/types"

/**
 * Embrulho comum das actions de pedido por link (estouro, Uber): roda a ação,
 * revalida as telas onde o pedido aparece (a lista do escalador e a do
 * motorista) e converte erro em `{ sucesso: false, erro }`.
 *
 * Sem "use server" de propósito: é um helper das actions, não uma action
 * que a tela possa chamar.
 */
export function actionsDePedidoLink(telas: readonly string[]) {
  const revalidarTelas = () => {
    for (const tela of telas) revalidatePath(tela)
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

  return { comLink, semRetorno }
}
