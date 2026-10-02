"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

/**
 * Recarrega os dados da página (router.refresh — sem perder o que está
 * aberto) de tempos em tempos, só com a aba visível. Usado no Dashboard: o
 * que o motorista registra no celular aparece sozinho.
 */
export function AtualizacaoAutomatica({ segundos = 60 }: { segundos?: number }) {
  const router = useRouter()

  useEffect(() => {
    const atualizar = () => {
      if (document.visibilityState === "visible") router.refresh()
    }
    const intervalo = window.setInterval(atualizar, segundos * 1000)
    document.addEventListener("visibilitychange", atualizar)
    return () => {
      window.clearInterval(intervalo)
      document.removeEventListener("visibilitychange", atualizar)
    }
  }, [router, segundos])

  return null
}
