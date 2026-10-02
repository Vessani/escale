import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { ehMotorista } from "@/lib/papeis"
import { buscarViagensParaRelatorioGeral } from "@/lib/queries/viagens"
import { gerarExcelRelatorioGeral } from "@/lib/services/excel-export.service"
import { formatarStatusViagem, parseStatusFiltro } from "@/lib/services/viagem-status.service"
import { buscarNomeFilial } from "@/lib/queries/filiais"
import { respostaExcel } from "@/lib/excel/resposta"
import { formatarDiaCompleto } from "@/lib/relatorios/formato"
import { parseDataLocal } from "@/lib/utils/date-format"

export async function GET(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.filialId === null || ehMotorista(session.user.role)) {
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

  const [viagens, filial] = await Promise.all([
    buscarViagensParaRelatorioGeral(session.user.filialId, { status, de, ate }),
    buscarNomeFilial(session.user.filialId),
  ])
  const periodo =
    de || ate ? `Período ${de ? formatarDiaCompleto(de) : "início"} a ${ate ? formatarDiaCompleto(ate) : "hoje"}` : "Todo o histórico"
  const filtroStatus = status === "TODOS" ? "todos os status" : `status ${formatarStatusViagem(status)}`
  const buffer = await gerarExcelRelatorioGeral(viagens, { filial, subtitulo: `${periodo} · ${filtroStatus}` })
  return respostaExcel(buffer, "relatorio-geral-viagens")
}
