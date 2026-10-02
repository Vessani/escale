"use client"

import { useEffect, useState } from "react"
import { Maximize2, Minimize2 } from "lucide-react"
import { Button } from "@/components/ui/button"

/**
 * Regras do modo TV junto do botão (não no CSS global) e ligadas a um
 * atributo que o próprio botão põe no painel — não dependem de o navegador
 * casar `:fullscreen` nem de a página ter carregado a folha de estilo nova.
 */
function estilosModoTv(alvoId: string) {
  const alvo = `#${alvoId}[data-modo-tv]`
  return `
${alvo} {
  background: var(--background);
  color: var(--foreground);
  overflow-y: auto;
  padding: 1.25rem 1.5rem;
  /* Um pouco maior que a tela normal, legível de longe sem perder espaço. */
  zoom: 1.2;
}
/* Navegador sem tela cheia (ex.: o da própria TV): ocupa a janela inteira. */
${alvo}[data-modo-tv="janela"] {
  position: fixed;
  inset: 0;
  z-index: 100;
}
${alvo} .fora-do-modo-tv {
  display: none !important;
}
/* <col> não some com display:none — zera a largura da coluna do download. */
${alvo} col.fora-do-modo-tv {
  display: table-column !important;
  width: 0;
}
${alvo} [data-slot="table-container"] {
  max-height: none;
}
/* Do cabeçalho só sobra o botão de sair: discreto, no canto de baixo (não cobre os dados). */
${alvo} > div:has(> div > [data-botao-modo-tv]) {
  position: fixed;
  bottom: 0.75rem;
  right: 1rem;
  opacity: 0.45;
}
`
}

type Modo = "desligado" | "tela-cheia" | "janela"

/**
 * Modo TV: o painel (elemento `alvoId`) em tela cheia, sem o menu lateral,
 * com letra maior e só o que serve pra olhar de longe. Esc sai.
 */
export function ModoTv({ alvoId }: { alvoId: string }) {
  const [modo, setModo] = useState<Modo>("desligado")

  // Marca o painel: é isso que liga as regras de estilosModoTv.
  useEffect(() => {
    const painel = document.getElementById(alvoId)
    if (!painel) return
    if (modo === "desligado") delete painel.dataset.modoTv
    else painel.dataset.modoTv = modo
  }, [alvoId, modo])

  useEffect(() => {
    // Saiu da tela cheia pelo Esc (ou pelo navegador): desliga o modo.
    const aoMudarTelaCheia = () => {
      if (!document.fullscreenElement) setModo((atual) => (atual === "tela-cheia" ? "desligado" : atual))
    }
    const aoTeclar = (evento: KeyboardEvent) => {
      if (evento.key === "Escape") setModo((atual) => (atual === "janela" ? "desligado" : atual))
    }
    document.addEventListener("fullscreenchange", aoMudarTelaCheia)
    document.addEventListener("keydown", aoTeclar)
    return () => {
      document.removeEventListener("fullscreenchange", aoMudarTelaCheia)
      document.removeEventListener("keydown", aoTeclar)
    }
  }, [])

  async function alternar() {
    if (modo !== "desligado") {
      if (document.fullscreenElement) await document.exitFullscreen().catch(() => undefined)
      setModo("desligado")
      return
    }
    const painel = document.getElementById(alvoId)
    try {
      await painel?.requestFullscreen()
      setModo("tela-cheia")
    } catch {
      setModo("janela")
    }
  }

  const ativo = modo !== "desligado"
  return (
    <>
      <style>{estilosModoTv(alvoId)}</style>
      <Button
        type="button"
        variant={ativo ? "ghost" : "outline"}
        size="sm"
        onClick={alternar}
        data-botao-modo-tv=""
        title={ativo ? "Sair do modo TV (Esc)" : "Painel em tela cheia, letra maior, pra deixar na TV"}
      >
        {ativo ? <Minimize2 className="mr-2 size-4" aria-hidden /> : <Maximize2 className="mr-2 size-4" aria-hidden />}
        {ativo ? "Sair do modo TV" : "Modo TV"}
      </Button>
    </>
  )
}
