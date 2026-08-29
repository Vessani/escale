import { requireSessaoApi } from "@/lib/api-auth"
import { respostaSucesso, respostaErro } from "@/lib/api-response"
import { buscarViagemPorId } from "@/lib/queries/viagens"
import { serializeData } from "@/lib/serialization"
import { ViagemNaoEncontradaError } from "@/lib/errors"

/**
 * Detalhe de uma viagem, já escopado pela filial da sessão — um id de
 * outra filial (ou inválido) devolve 404, nunca vaza que o registro existe
 * noutro lugar (mesmo comportamento de app/api/viagens/[id]/excel).
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { filialId } = await requireSessaoApi()
    const { id } = await params
    const viagemId = Number.parseInt(id, 10)

    if (!Number.isInteger(viagemId)) {
      throw new ViagemNaoEncontradaError()
    }

    const viagem = await buscarViagemPorId(filialId, viagemId)
    if (!viagem) {
      throw new ViagemNaoEncontradaError()
    }

    return respostaSucesso(serializeData(viagem))
  } catch (erro) {
    return respostaErro(erro)
  }
}
