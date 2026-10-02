import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { ehMotorista } from "@/lib/papeis"
import { buscarViagensCriadasEm } from "@/lib/queries/viagens"
import { buscarNomeFilial } from "@/lib/queries/filiais"
import { gerarExcelViagensCriadasHoje } from "@/lib/services/excel-export.service"
import { respostaExcel } from "@/lib/excel/resposta"
import { formatarDiaCompleto } from "@/lib/relatorios/formato"
import { parseDataLocal } from "@/lib/utils/date-format"

export async function GET(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.filialId === null || ehMotorista(session.user.role)) {
    return new Response("Não autorizado.", { status: 401 })
  }

  const url = new URL(request.url)
  const dataTexto = url.searchParams.get("data")

  let data: Date
  try {
    data = dataTexto ? parseDataLocal(dataTexto) : new Date()
  } catch {
    return new Response("Data inválida.", { status: 400 })
  }

  const [viagens, filial] = await Promise.all([
    buscarViagensCriadasEm(session.user.filialId, data),
    buscarNomeFilial(session.user.filialId),
  ])
  const buffer = await gerarExcelViagensCriadasHoje(viagens, formatarDiaCompleto(data), { filial })
  return respostaExcel(buffer, "viagens-criadas")
}
