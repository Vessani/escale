import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { buscarViagemPorId } from "@/lib/queries/viagens"
import { gerarExcelViagem, sanitizarNomeArquivo } from "@/lib/services/excel-export.service"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.filialId === null) {
    return new Response("Não autorizado.", { status: 401 })
  }

  const { id } = await params
  const viagemId = Number.parseInt(id, 10)
  if (!Number.isInteger(viagemId)) {
    return new Response("ID de viagem inválido.", { status: 400 })
  }

  const viagem = await buscarViagemPorId(session.user.filialId, viagemId)
  if (!viagem) {
    return new Response("Viagem não encontrada.", { status: 404 })
  }

  const buffer = gerarExcelViagem(viagem)
  const excelBlob = new Blob([new Uint8Array(buffer)], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  })
  const nomeArquivo = sanitizarNomeArquivo(`viagem-${viagem.numViagem}.xlsx`)

  return new Response(excelBlob, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${nomeArquivo}"`,
      "Cache-Control": "no-store",
    },
  })
}
