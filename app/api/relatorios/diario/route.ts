import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { buscarViagensCriadasEm } from "@/lib/queries/viagens"
import { gerarExcelViagensCriadasHoje } from "@/lib/services/excel-export.service"
import { parseDataLocal } from "@/lib/utils/date-format"

export async function GET(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.filialId === null) {
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

  const viagens = await buscarViagensCriadasEm(session.user.filialId, data)
  const buffer = gerarExcelViagensCriadasHoje(viagens)
  const excelBlob = new Blob([new Uint8Array(buffer)], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  })

  return new Response(excelBlob, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="viagens-criadas.xlsx"',
      "Cache-Control": "no-store",
    },
  })
}
