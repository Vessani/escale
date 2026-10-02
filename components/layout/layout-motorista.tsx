"use client"

import { ReactNode } from "react"
import Link from "next/link"
import { signOut } from "next-auth/react"
import { LogOut } from "lucide-react"
import { Button } from "@/components/ui/button"
import { LogoEscale } from "@/components/layout/logo-escale"
import { Rodape } from "@/components/layout/rodape"
import { AREA_MOTORISTA } from "@/lib/papeis"
import { formatarNomeProprio } from "@/lib/utils/texto"

/**
 * Layout da área do motorista: feito pro celular — sem o menu do despacho,
 * só o nome dele e o botão de sair no topo.
 */
export function LayoutMotorista({ nome, children }: { nome: string | null | undefined; children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-muted/40">
      <header className="sticky top-0 z-20 bg-sidebar text-white/80 shadow-md">
        <div className="mx-auto flex max-w-xl items-center justify-between gap-3 px-4 py-3">
          <Link href={AREA_MOTORISTA} className="flex min-w-0 items-center gap-3">
            <LogoEscale compacto />
            <span className="truncate text-sm font-medium text-white">{nome ? formatarNomeProprio(nome) : "Motorista"}</span>
          </Link>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-white/80 hover:bg-white/10 hover:text-white"
            onClick={() => signOut({ callbackUrl: "/login" })}
          >
            <LogOut className="size-4" aria-hidden />
            Sair
          </Button>
        </div>
      </header>
      <main className="mx-auto w-full max-w-xl flex-1 space-y-4 px-4 py-4">{children}</main>
      <Rodape className="mx-auto mb-4 w-full max-w-xl px-4" />
    </div>
  )
}
