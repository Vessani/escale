import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

/**
 * Reforça a sessão dentro da própria Server Action — o middleware já
 * bloqueia a navegação às páginas sem login, mas uma Action pode ser
 * invocada diretamente (POST), então a checagem não pode depender só dele.
 */
export async function requireSession() {
  const session = await getServerSession(authOptions)

  if (!session) {
    throw new Error("Não autorizado.")
  }

  return session
}
