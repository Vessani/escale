import { requireSessaoApi } from "@/lib/api-auth"
import { respostaSucesso, respostaErro } from "@/lib/api-response"
import { buscarViagens } from "@/lib/queries/viagens"
import { serializeData } from "@/lib/serialization"

// TODO endpoints de escrita, pro app do motorista (reusando os services que
// as Server Actions já usam — ver lib/services/viagem.service.ts):
// - POST /api/viagens/[id]/status  (atualizarStatusViagemService — iniciar/
//   finalizar viagem, etc.)
// - POST /api/viagens/[id]/saida   (atualizarSaidaRealService — registrar
//   horário real de saída)

/** Lista as viagens da filial da sessão (qualquer status) — mesma consulta usada por app/viagens/page.tsx. */
export async function GET() {
  try {
    const { filialId } = await requireSessaoApi()
    const viagens = await buscarViagens(filialId)

    return respostaSucesso(serializeData(viagens))
  } catch (erro) {
    return respostaErro(erro)
  }
}
