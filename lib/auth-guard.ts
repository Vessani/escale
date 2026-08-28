import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { NaoAutorizadoError } from "@/lib/errors"

/**
 * Reforça a sessão dentro da própria Server Action — o middleware já
 * bloqueia a navegação às páginas sem login, mas uma Action pode ser
 * invocada diretamente (POST), então a checagem não pode depender só dele.
 *
 * Passando `rolesPermitidos`, também exige que `session.user.role` esteja
 * nessa lista (ex: ações admin-only como excluir) — sem isso, qualquer
 * usuário autenticado tem acesso irrestrito à action.
 */
export async function requireSession(rolesPermitidos?: string[]) {
  const session = await getServerSession(authOptions)

  if (!session) {
    throw new NaoAutorizadoError()
  }

  if (rolesPermitidos && !rolesPermitidos.includes(session.user.role)) {
    throw new NaoAutorizadoError()
  }

  return session
}

/**
 * Mesma checagem de requireSession, mas pra actions operacionais (viagens/
 * motoristas/frotas/quadro): exige também que a sessão tenha uma filial —
 * SUPERADMIN não tem (gerencia filiais/usuários, não opera dentro de uma) e
 * cairia aqui se tentasse chamar uma action operacional diretamente.
 * Devolve o filialId já resolvido, pra não repetir a checagem de null em
 * cada action.
 */
export async function requireSessionComFilial(rolesPermitidos?: string[]) {
  const session = await requireSession(rolesPermitidos)

  if (session.user.filialId === null) {
    throw new NaoAutorizadoError()
  }

  return { session, filialId: session.user.filialId }
}
