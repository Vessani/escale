import { requireSessaoApi } from "@/lib/api-auth"
import { respostaErro } from "@/lib/api-response"
import { buscarViagensCriadasEm } from "@/lib/queries/viagens"
import { buscarNomeFilial } from "@/lib/queries/filiais"
import { gerarExcelViagensCriadasHoje } from "@/lib/services/excel-export.service"
import { respostaExcel } from "@/lib/excel/resposta"
import { formatarDiaCompleto } from "@/lib/relatorios/formato"
import { parseDataLocal } from "@/lib/utils/date-format"

export async function GET(request: Request) {
  // Mesma checagem de todas as rotas (sessão, filial, motorista não entra) — lib/api-auth.ts.
  let filialId: number
  try {
    ;({ filialId } = await requireSessaoApi())
  } catch (erro) {
    return respostaErro(erro)
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
    buscarViagensCriadasEm(filialId, data),
    buscarNomeFilial(filialId),
  ])
  const buffer = await gerarExcelViagensCriadasHoje(viagens, formatarDiaCompleto(data), { filial })
  return respostaExcel(buffer, "viagens-criadas")
}
