import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { buscarRelatorioCircadiano } from "@/lib/queries/circadiano"
import { gerarExcelCircadiano } from "@/lib/services/excel-export.service"
import { periodoCircadiano } from "@/lib/services/circadiano-periodo"

export async function GET(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.filialId === null) {
    return new Response("Não autorizado.", { status: 401 })
  }

  const url = new URL(request.url)
  const periodo = periodoCircadiano(url.searchParams.get("de") ?? undefined, url.searchParams.get("ate") ?? undefined)
  if (!periodo) {
    return new Response("Período inválido.", { status: 400 })
  }

  const relatorio = await buscarRelatorioCircadiano(session.user.filialId, periodo.de, periodo.ate)
  const buffer = gerarExcelCircadiano(relatorio)
  const excelBlob = new Blob([new Uint8Array(buffer)], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  })

  return new Response(excelBlob, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="ciclo-circadiano-${periodo.deTexto}-a-${periodo.ateTexto}.xlsx"`,
      "Cache-Control": "no-store",
    },
  })
}
