import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { buscarViagensParaRelatorioGeral } from "@/lib/queries/viagens"
import { gerarExcelRelatorioGeral } from "@/lib/services/excel-export.service"
import { parseStatusFiltro } from "@/lib/services/viagem-status.service"
import { parseDataLocal } from "@/lib/utils/date-format"

export async function GET(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.filialId === null) {
    return new Response("Não autorizado.", { status: 401 })
  }

  const url = new URL(request.url)
  const status = parseStatusFiltro(url.searchParams.get("status") ?? undefined)
  const deTexto = url.searchParams.get("de")
  const ateTexto = url.searchParams.get("ate")

  let de: Date | undefined
  let ate: Date | undefined
  try {
    de = deTexto ? parseDataLocal(deTexto) : undefined
    ate = ateTexto ? parseDataLocal(ateTexto) : undefined
  } catch {
    return new Response("Período inválido.", { status: 400 })
  }

  const viagens = await buscarViagensParaRelatorioGeral(session.user.filialId, { status, de, ate })
  const buffer = gerarExcelRelatorioGeral(viagens)
  const excelBlob = new Blob([new Uint8Array(buffer)], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  })

  return new Response(excelBlob, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="relatorio-geral-viagens.xlsx"',
      "Cache-Control": "no-store",
    },
  })
}
