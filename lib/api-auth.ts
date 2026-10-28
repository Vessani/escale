import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { NaoAutorizadoError } from "@/lib/errors"
import { ehMotorista, ehTorre } from "@/lib/papeis"
import { filialDaTorre } from "@/lib/torre"

/**
 * Autenticação pra route handlers (app/api/**\/route.ts) — mesma checagem de
 * requireSessionComFilial (lib/auth-guard.ts), mas pro contexto de
 * Request/Response de uma rota HTTP em vez de Server Action (o middleware já
 * bloqueia navegação de página sem login, mas uma rota de API pode ser
 * chamada diretamente). Lança NaoAutorizadoError em vez de devolver a
 * Response 401 direto, pra passar pelo mesmo tratamento de erro tipado do
 * resto do app (ver respostaErro em lib/api-response.ts) — SUPERADMIN
 * (sem filial) também cai aqui, já que toda rota exposta hoje é operacional,
 * escopada por filial.
 *
 * A torre entra: toda rota daqui é só leitura (GET de listas, relatórios e
 * Excel), na filial que ela escolheu no menu. Rota nova que grave algo
 * precisa barrar a torre.
 */
export async function requireSessaoApi() {
  const session = await getServerSession(authOptions)

  // Motorista não usa nenhuma rota de API (relatórios, Excel, listas).
  if (!session || ehMotorista(session.user.role)) {
    throw new NaoAutorizadoError()
  }

  const filialId = ehTorre(session.user.role) ? await filialDaTorre() : session.user.filialId
  if (filialId === null) {
    throw new NaoAutorizadoError()
  }

  return { session, filialId }
}
