import { requireSessaoApi } from "@/lib/api-auth"
import { respostaErro } from "@/lib/api-response"
import { EXPORTADORES_RELATORIO } from "@/lib/relatorios/exportacao"
import { gerarExcel } from "@/lib/excel/planilha"
import { respostaExcel } from "@/lib/excel/resposta"
import { buscarNomeFilial } from "@/lib/queries/filiais"

/** Excel de qualquer relatório de /relatorios/* — os mesmos filtros da tela vêm na URL. */
export async function GET(request: Request, { params }: { params: Promise<{ tipo: string }> }) {
  try {
    const { filialId } = await requireSessaoApi()
    const { tipo } = await params
    const exportar = Object.hasOwn(EXPORTADORES_RELATORIO, tipo) ? EXPORTADORES_RELATORIO[tipo] : undefined
    if (!exportar) {
      return new Response("Relatório não encontrado.", { status: 404 })
    }

    const resultado = await exportar(filialId, new URL(request.url).searchParams)
    if (!resultado) {
      return new Response("Filtro inválido.", { status: 400 })
    }

    const buffer = await gerarExcel(resultado.abas, { filial: await buscarNomeFilial(filialId) })
    return respostaExcel(buffer, resultado.arquivo)
  } catch (erro) {
    return respostaErro(erro)
  }
}
