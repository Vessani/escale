import { requireSessaoApi } from "@/lib/api-auth"
import { respostaErro } from "@/lib/api-response"
import { buscarProgramacaoDoDia } from "@/lib/queries/viagens"
import { buscarNomeFilial } from "@/lib/queries/filiais"
import { excelProgramacaoDoDia } from "@/lib/excel/viagens"
import { respostaExcel } from "@/lib/excel/resposta"
import { diaParaTexto } from "@/lib/relatorios/periodo"
import { parseDataLocal } from "@/lib/utils/date-format"

/** Programação do dia (?data=YYYY-MM-DD, padrão hoje): todas as viagens com motorista, frota e entregas. */
export async function GET(request: Request) {
  try {
    const { filialId } = await requireSessaoApi()
    const dataTexto = new URL(request.url).searchParams.get("data")

    let dia: Date
    try {
      dia = dataTexto ? parseDataLocal(dataTexto) : new Date()
    } catch {
      return new Response("Data inválida.", { status: 400 })
    }

    const [viagens, filial] = await Promise.all([buscarProgramacaoDoDia(filialId, dia), buscarNomeFilial(filialId)])
    const buffer = await excelProgramacaoDoDia({ dia, viagens, meta: { filial } })
    return respostaExcel(buffer, `programacao-${diaParaTexto(dia)}`)
  } catch (erro) {
    return respostaErro(erro)
  }
}
