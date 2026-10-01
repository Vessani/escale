"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { RotateCcw, TriangleAlert } from "lucide-react"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"
import { registrarErroNoNavegador } from "@/lib/actions/erros"

/** Código curto pra pessoa repassar ("deu erro, código K7P2QX") — o mesmo vai pro log do servidor. */
function gerarCodigo() {
  return Math.random().toString(36).slice(2, 8).toUpperCase()
}

/**
 * Tela mostrada quando algo quebra dentro de uma página (app/error.tsx): o
 * menu continua, a pessoa pode tentar de novo, e o erro vai pro log com um
 * código que ela vê na tela.
 */
export function TelaErro({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  const pagina = usePathname()
  const [codigo] = useState(gerarCodigo)

  useEffect(() => {
    console.error(error)
    void registrarErroNoNavegador({ codigo, mensagem: error.message, pagina, digest: error.digest }).catch(() => {})
  }, [error, codigo, pagina])

  return (
    <EmptyState
      icone={TriangleAlert}
      classeIcone="text-warning"
      titulo="Algo deu errado nesta tela"
      descricao={
        <>
          O que já estava salvo não foi perdido. Tente de novo — se continuar, avise com o código{" "}
          <span className="font-mono font-semibold text-foreground">{codigo}</span>.
        </>
      }
      acao={
        <div className="flex flex-wrap justify-center gap-2">
          <Button type="button" onClick={() => retry()}>
            <RotateCcw className="size-4" aria-hidden />
            Tentar de novo
          </Button>
          <Button asChild variant="outline">
            <Link href="/">Ir pro Dashboard</Link>
          </Button>
        </div>
      }
    />
  )
}
