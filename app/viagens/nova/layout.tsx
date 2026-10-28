import type { ReactNode } from "react"
import { requireSessaoPagina } from "@/lib/auth-guard"

/**
 * A página é de cliente (formulário), então a checagem de servidor fica
 * aqui: sem ela a torre (só consulta) e o motorista abririam o formulário
 * vazio — gravar já era barrado na action.
 */
export default async function Layout({ children }: { children: ReactNode }) {
  await requireSessaoPagina()
  return children
}
