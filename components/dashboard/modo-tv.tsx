"use client"

import { useEffect, useState } from "react"
import { Maximize2, Minimize2 } from "lucide-react"
import { Button } from "@/components/ui/button"

/**
 * Modo TV: o painel (elemento `alvoId`) em tela cheia, sem o menu lateral,
 * com letra maior e só o que serve pra olhar de longe (ver
 * `#painel-dashboard:fullscreen` em globals.css). Esc também sai.
 */
export function ModoTv({ alvoId }: { alvoId: string }) {
  const [ativo, setAtivo] = useState(false)

  useEffect(() => {
    const atualizar = () => setAtivo(document.fullscreenElement?.id === alvoId)
    document.addEventListener("fullscreenchange", atualizar)
    return () => document.removeEventListener("fullscreenchange", atualizar)
  }, [alvoId])

  async function alternar() {
    if (document.fullscreenElement) {
      await document.exitFullscreen()
      return
    }
    await document.getElementById(alvoId)?.requestFullscreen()
  }

  return (
    <Button type="button" variant={ativo ? "ghost" : "outline"} size="sm" onClick={alternar} title={ativo ? "Sair do modo TV (Esc)" : "Painel em tela cheia, letra maior, pra deixar na TV"}>
      {ativo ? <Minimize2 className="mr-2 size-4" aria-hidden /> : <Maximize2 className="mr-2 size-4" aria-hidden />}
      {ativo ? "Sair do modo TV" : "Modo TV"}
    </Button>
  )
}
