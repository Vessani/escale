import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { ehMotorista } from "@/lib/papeis"
import { buscarMotoristaPorId } from "@/lib/queries/motoristas"
import { buscarViagensPorMotorista } from "@/lib/queries/viagens"
import { buscarNomeFilial } from "@/lib/queries/filiais"
import { gerarExcelViagensMotorista, sanitizarNomeArquivo } from "@/lib/services/excel-export.service"
import { respostaExcel } from "@/lib/excel/resposta"
import { formatarNomeProprio } from "@/lib/utils/texto"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.filialId === null || ehMotorista(session.user.role)) {
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

  const [viagens, filial] = await Promise.all([
    buscarViagensPorMotorista(session.user.filialId, motoristaId),
    buscarNomeFilial(session.user.filialId),
  ])
  const buffer = await gerarExcelViagensMotorista(viagens, formatarNomeProprio(motorista.nome), { filial })
  return respostaExcel(buffer, sanitizarNomeArquivo(`viagens-${motorista.nome}`))
}
