import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { buscarMotoristaPorId } from "@/lib/queries/motoristas"
import { buscarViagensPorMotorista } from "@/lib/queries/viagens"
import { gerarExcelViagensMotorista, sanitizarNomeArquivo } from "@/lib/services/excel-export.service"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.filialId === null) {
    return new Response("Não autorizado.", { status: 401 })
  }

  const { id } = await params
  const motoristaId = Number.parseInt(id, 10)
  if (!Number.isInteger(motoristaId)) {
    return new Response("ID de motorista inválido.", { status: 400 })
  }

  const motorista = await buscarMotoristaPorId(session.user.filialId, motoristaId)
  if (!motorista) {
    return new Response("Motorista não encontrado.", { status: 404 })
  }

  const viagens = await buscarViagensPorMotorista(session.user.filialId, motoristaId)
  const buffer = gerarExcelViagensMotorista(viagens)
  const excelBlob = new Blob([new Uint8Array(buffer)], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  })
  const nomeArquivo = sanitizarNomeArquivo(`viagens-${motorista.nome}.xlsx`)

  return new Response(excelBlob, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${nomeArquivo}"`,
      "Cache-Control": "no-store",
    },
  })
}
