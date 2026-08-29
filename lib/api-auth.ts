import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { NaoAutorizadoError } from "@/lib/errors"

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
 */
export async function requireSessaoApi() {
  const session = await getServerSession(authOptions)

  if (!session || session.user.filialId === null) {
    throw new NaoAutorizadoError()
  }

  return { session, filialId: session.user.filialId }
}
