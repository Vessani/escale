"use client"

import { Printer } from "lucide-react"
import { Button } from "@/components/ui/button"

/** Imprimir ou "Salvar como PDF" pelo navegador. */
export function BotaoImprimir() {
  return (
    <Button type="button" onClick={() => window.print()}>
      <Printer className="mr-2 size-4" aria-hidden /> Imprimir / PDF
    </Button>
  )
}
