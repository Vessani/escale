import { requireSessaoApi } from "@/lib/api-auth"
import { respostaErro } from "@/lib/api-response"
import { buscarMotoristaPorId } from "@/lib/queries/motoristas"
import { buscarViagensPorMotorista } from "@/lib/queries/viagens"
import { buscarNomeFilial } from "@/lib/queries/filiais"
import { gerarExcelViagensMotorista, sanitizarNomeArquivo } from "@/lib/services/excel-export.service"
import { respostaExcel } from "@/lib/excel/resposta"
import { formatarNomeProprio } from "@/lib/utils/texto"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  // Mesma checagem de todas as rotas (sessão, filial, motorista não entra) — lib/api-auth.ts.
  let filialId: number
  try {
    ;({ filialId } = await requireSessaoApi())
  } catch (erro) {
    return respostaErro(erro)
  }

  const { id } = await params
  const motoristaId = Number.parseInt(id, 10)
  if (!Number.isInteger(motoristaId)) {
    return new Response("ID de motorista inválido.", { status: 400 })
  }

  const motorista = await buscarMotoristaPorId(filialId, motoristaId)
  if (!motorista) {
    return new Response("Motorista não encontrado.", { status: 404 })
  }

  const [viagens, filial] = await Promise.all([
    buscarViagensPorMotorista(filialId, motoristaId),
    buscarNomeFilial(filialId),
  ])
  const buffer = await gerarExcelViagensMotorista(viagens, formatarNomeProprio(motorista.nome), { filial })
  return respostaExcel(buffer, sanitizarNomeArquivo(`viagens-${motorista.nome}`))
}
