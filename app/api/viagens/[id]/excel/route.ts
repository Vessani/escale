import { requireSessaoApi } from "@/lib/api-auth"
import { respostaErro } from "@/lib/api-response"
import { buscarViagemPorId } from "@/lib/queries/viagens"
import { buscarNomeFilial } from "@/lib/queries/filiais"
import { gerarExcelViagem, sanitizarNomeArquivo } from "@/lib/services/excel-export.service"
import { respostaExcel } from "@/lib/excel/resposta"

/** Ordem de viagem em Excel — uma viagem, pra imprimir ou mandar pro motorista. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  // Mesma checagem de todas as rotas (sessão, filial, motorista não entra) — lib/api-auth.ts.
  let filialId: number
  try {
    ;({ filialId } = await requireSessaoApi())
  } catch (erro) {
    return respostaErro(erro)
  }

  const { id } = await params
  const viagemId = Number.parseInt(id, 10)
  if (!Number.isInteger(viagemId)) {
    return new Response("ID de viagem inválido.", { status: 400 })
  }

  const [viagem, filial] = await Promise.all([buscarViagemPorId(filialId, viagemId), buscarNomeFilial(filialId)])
  if (!viagem) {
    return new Response("Viagem não encontrada.", { status: 404 })
  }

  const buffer = await gerarExcelViagem(viagem, { filial })
  return respostaExcel(buffer, sanitizarNomeArquivo(`viagem-${viagem.numViagem}`))
}
