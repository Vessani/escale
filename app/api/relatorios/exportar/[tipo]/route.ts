import { requireSessaoApi } from "@/lib/api-auth"
import { respostaErro } from "@/lib/api-response"
import { EXPORTADORES_RELATORIO } from "@/lib/relatorios/exportacao"
import { gerarPlanilhaExcel } from "@/lib/services/excel-export.service"

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

    const buffer = gerarPlanilhaExcel(resultado.planilhas)
    return new Response(new Blob([new Uint8Array(buffer)]), {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${resultado.arquivo}.xlsx"`,
        "Cache-Control": "no-store",
      },
    })
  } catch (erro) {
    return respostaErro(erro)
  }
}
