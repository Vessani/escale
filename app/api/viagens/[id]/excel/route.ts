import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { ehMotorista } from "@/lib/papeis"
import { buscarViagemPorId } from "@/lib/queries/viagens"
import { buscarNomeFilial } from "@/lib/queries/filiais"
import { gerarExcelViagem, sanitizarNomeArquivo } from "@/lib/services/excel-export.service"
import { respostaExcel } from "@/lib/excel/resposta"

/** Ordem de viagem em Excel — uma viagem, pra imprimir ou mandar pro motorista. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.filialId === null || ehMotorista(session.user.role)) {
    return new Response("Não autorizado.", { status: 401 })
  }

  const { id } = await params
  const viagemId = Number.parseInt(id, 10)
  if (!Number.isInteger(viagemId)) {
    return new Response("ID de viagem inválido.", { status: 400 })
  }

  const [viagem, filial] = await Promise.all([
    buscarViagemPorId(session.user.filialId, viagemId),
    buscarNomeFilial(session.user.filialId),
  ])
  if (!viagem) {
    return new Response("Viagem não encontrada.", { status: 404 })
  }

  const buffer = await gerarExcelViagem(viagem, { filial })
  return respostaExcel(buffer, sanitizarNomeArquivo(`viagem-${viagem.numViagem}`))
}
