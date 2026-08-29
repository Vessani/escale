import { requireSessaoApi } from "@/lib/api-auth"
import { respostaSucesso, respostaErro } from "@/lib/api-response"
import { buscarMotoristas } from "@/lib/queries/motoristas"
import { serializeData } from "@/lib/serialization"

/** Lista os motoristas ativos (não deletados) da filial da sessão, pra consumo externo — ex: app do motorista. */
export async function GET() {
  try {
    const { filialId } = await requireSessaoApi()
    const motoristas = await buscarMotoristas(filialId)

    return respostaSucesso(serializeData(motoristas))
  } catch (erro) {
    return respostaErro(erro)
  }
}
