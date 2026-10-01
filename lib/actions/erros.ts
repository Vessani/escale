'use server'

import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

/** Corta texto vindo do navegador — o registro de erro não pode virar um jeito de encher o log. */
function cortar(valor: unknown, limite: number): string {
  return typeof valor === "string" ? valor.slice(0, limite) : ""
}

/**
 * Erro que derrubou uma tela no navegador (ver app/error.tsx). Vai pro log
 * do servidor (Vercel → Logs) com o mesmo código mostrado na tela, quem
 * estava usando e em que página — dá pra achar o que aconteceu quando
 * alguém avisar "deu erro" e mandar o código.
 */
export async function registrarErroNoNavegador(dados: { codigo: string; mensagem: string; pagina: string; digest?: string }) {
  const sessao = await getServerSession(authOptions).catch(() => null)
  console.error(
    "[erro-navegador]",
    JSON.stringify({
      codigo: cortar(dados?.codigo, 20),
      digest: cortar(dados?.digest, 40) || undefined,
      pagina: cortar(dados?.pagina, 200),
      mensagem: cortar(dados?.mensagem, 500),
      usuario: sessao?.user?.email ?? sessao?.user?.id ?? null,
    }),
  )
}
