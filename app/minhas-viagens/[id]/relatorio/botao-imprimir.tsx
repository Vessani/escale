"use client"

import { Printer } from "lucide-react"
import { Button } from "@/components/ui/button"

/** Imprimir — no celular, o próprio navegador oferece "Salvar como PDF" ou compartilhar. */
export function BotaoImprimir() {
  return (
    <Button type="button" className="h-11" onClick={() => window.print()}>
      <Printer className="mr-2 size-4" aria-hidden /> Imprimir
    </Button>
  )
}
