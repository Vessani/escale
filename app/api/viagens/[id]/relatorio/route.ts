import { requireSessaoApi } from "@/lib/api-auth"
import { respostaErro } from "@/lib/api-response"
import { gerarExcel } from "@/lib/excel/planilha"
import { respostaExcel } from "@/lib/excel/resposta"
import { buscarNomeFilial } from "@/lib/queries/filiais"
import { carregarRelatorioViagem } from "@/lib/relatorios/relatorio-viagem"
import { abasRelatorioViagem } from "@/lib/relatorios/excel-relatorio-viagem"
import { sanitizarNomeArquivo } from "@/lib/services/excel-export.service"

/** Excel do "Relatório da viagem" — tudo o que aconteceu, em abas. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { filialId } = await requireSessaoApi()
    const viagemId = Number((await params).id)
    if (!Number.isInteger(viagemId) || viagemId <= 0) return new Response("ID de viagem inválido.", { status: 400 })

    const relatorio = await carregarRelatorioViagem(filialId, viagemId)
    if (!relatorio) return new Response("Viagem não encontrada.", { status: 404 })

    const buffer = await gerarExcel(abasRelatorioViagem(relatorio), { filial: await buscarNomeFilial(filialId) })
    return respostaExcel(buffer, sanitizarNomeArquivo(`relatorio-viagem-${relatorio.numViagem}`))
  } catch (erro) {
    return respostaErro(erro)
  }
}
