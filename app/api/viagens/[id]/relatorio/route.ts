import { requireSessaoApi } from "@/lib/api-auth"
import { ehGerencia } from "@/lib/papeis"
import { respostaErro } from "@/lib/api-response"
import { gerarExcel } from "@/lib/excel/planilha"
import { respostaExcel } from "@/lib/excel/resposta"
import { buscarNomeFilial } from "@/lib/queries/filiais"
import { carregarRelatorioViagem } from "@/lib/relatorios/relatorio-viagem"
import { abasRelatorioViagem } from "@/lib/relatorios/excel-relatorio-viagem"
import { sanitizarNomeArquivo } from "@/lib/services/excel-export.service"

/** Excel do "Relatório da viagem" — tudo o que aconteceu, numa aba, em seções. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { filialId, session } = await requireSessaoApi()
    const viagemId = Number((await params).id)
    if (!Number.isInteger(viagemId) || viagemId <= 0) return new Response("ID de viagem inválido.", { status: 400 })

    const relatorio = await carregarRelatorioViagem(filialId, viagemId, { comLinhaDoTempo: ehGerencia(session.user.role) })
    if (!relatorio) return new Response("Viagem não encontrada.", { status: 404 })

    const buffer = await gerarExcel(abasRelatorioViagem(relatorio), { filial: await buscarNomeFilial(filialId) })
    return respostaExcel(buffer, sanitizarNomeArquivo(`relatorio-viagem-${relatorio.numViagem}`))
  } catch (erro) {
    return respostaErro(erro)
  }
}
