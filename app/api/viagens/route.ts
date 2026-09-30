import { requireSessaoApi } from "@/lib/api-auth"
import { respostaSucesso, respostaErro } from "@/lib/api-response"
import { buscarViagensPaginadas } from "@/lib/queries/viagens"
import { parseFiltroListaViagens } from "@/lib/services/filtro-viagens"
import { serializeData } from "@/lib/serialization"

// TODO endpoints de escrita, pro app do motorista (reusando os services que
// as Server Actions já usam — ver lib/services/viagem.service.ts):
// - POST /api/viagens/[id]/status  (atualizarStatusViagemService — iniciar/
//   finalizar viagem, etc.)
// - POST /api/viagens/[id]/saida   (atualizarSaidaRealService — registrar
//   horário real de saída)

/**
 * Lista as viagens da filial da sessão — mesma consulta paginada de
 * app/viagens/page.tsx, com os mesmos filtros na URL (?status, ?de, ?ate,
 * ?q, ?pagina; sem nada, uma semana pra trás e um mês pra frente). Antes
 * devolvia o histórico inteiro de uma vez.
 */
export async function GET(request: Request) {
  try {
    const { filialId } = await requireSessaoApi()
    const parametros = Object.fromEntries(new URL(request.url).searchParams)
    const filtro = parseFiltroListaViagens(parametros)
    const { viagens, total, totalPaginas } = await buscarViagensPaginadas(filialId, filtro)

    return respostaSucesso(serializeData({ viagens, pagina: filtro.pagina, totalPaginas, total }))
  } catch (erro) {
    return respostaErro(erro)
  }
}
