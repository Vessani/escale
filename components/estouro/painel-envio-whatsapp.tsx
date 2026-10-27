"use client"

import { useState } from "react"
import { Check, Copy, MessageCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { LinkGerado } from "@/lib/services/estouro-jornada.service"
import { VALIDADE_LINK_HORAS } from "@/lib/services/estouro-jornada-regras"
import { cn } from "@/lib/utils"

/**
 * Depois de criar (ou renovar) o pedido: abre o WhatsApp com a mensagem
 * pronta pra postar no grupo da filial. É um link de verdade (e não
 * window.open depois da action), senão o navegador do celular bloqueia como
 * pop-up. `grande`: botão do tamanho do celular (área do motorista).
 */
export function PainelEnvioWhatsApp({ link, grande = false }: { link: LinkGerado; grande?: boolean }) {
  const [copiado, setCopiado] = useState(false)

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(link.url)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2000)
    } catch {
      // Clipboard bloqueado (http sem localhost, permissão negada): o link continua visível pra copiar à mão.
    }
  }

  return (
    <div className="space-y-3">
      <Button asChild className={cn("w-full", grande && "h-12 text-base")}>
        <a href={link.linkWhatsApp} target="_blank" rel="noopener noreferrer">
          <MessageCircle className="mr-2 size-4" aria-hidden />
          Enviar no grupo da filial
        </a>
      </Button>
      <p className="text-sm text-foreground/80">O WhatsApp abre com a mensagem pronta: escolha o grupo da sua filial e envie.</p>
      <div className="flex items-center gap-2">
        <code className="flex-1 truncate rounded-md border bg-muted px-2 py-1.5 text-xs" title={link.url}>
          {link.url}
        </code>
        <Button type="button" variant="outline" size="sm" onClick={copiar}>
          {copiado ? <Check className="mr-1 size-4" aria-hidden /> : <Copy className="mr-1 size-4" aria-hidden />}
          {copiado ? "Copiado" : "Copiar link"}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        O link vale {VALIDADE_LINK_HORAS}h e serve pra uma única resposta. Por segurança ele não fica salvo — se perder, gere outro na
        lista.
      </p>
    </div>
  )
}
