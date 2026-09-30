"use client"

import { useRef, useState } from "react"
import { Popover } from "radix-ui"
import { ChevronRight, MapPin } from "lucide-react"
import { paradasDaRota, formatarNomeProprio } from "@/lib/utils/texto"
import { formatarDataHoraPtBr, formatarHoraLocal } from "@/lib/utils/date-format"
import { cn } from "@/lib/utils"

export type EntregaDaRota = {
  cidade: string
  uf?: string | null
  cliente?: string | null
  dataEntrega?: string | Date | null
}

const ATRASO_ABRIR_MS = 120
const ATRASO_FECHAR_MS = 150

/**
 * Rota da viagem numa linha — origem e destino final, com as paradas do
 * meio contadas ("📍 Joinville › +3 › Rio do Sul") — que,
 * ao passar o mouse ou clicar (toque no celular), abre um painel com todas
 * as entregas em ordem: cidade/UF, cliente e horário. Mesmo padrão da saída
 * real — a célula fica curta e o detalhe aparece quando alguém pede.
 */
export function RotaDestinos({ entregas, className }: { entregas: EntregaDaRota[]; className?: string }) {
  const [aberto, setAberto] = useState(false)
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null)
  const paradas = paradasDaRota(entregas.map((entrega) => entrega.cidade))

  if (paradas.length === 0) {
    return <span className="text-muted-foreground">—</span>
  }

  const origem = paradas[0]
  const destino = paradas.length > 1 ? paradas[paradas.length - 1] : null
  const intermediarias = Math.max(0, paradas.length - 2)

  const agendar = (proximo: boolean) => {
    if (temporizador.current) clearTimeout(temporizador.current)
    temporizador.current = setTimeout(() => setAberto(proximo), proximo ? ATRASO_ABRIR_MS : ATRASO_FECHAR_MS)
  }
  // Hover só pra mouse — no toque, o clique (onOpenChange) é que abre/fecha.
  const aoEntrar = (evento: React.PointerEvent) => evento.pointerType === "mouse" && agendar(true)
  const aoSair = (evento: React.PointerEvent) => evento.pointerType === "mouse" && agendar(false)

  return (
    <Popover.Root open={aberto} onOpenChange={setAberto}>
      <Popover.Trigger asChild>
        <button
          type="button"
          onPointerEnter={aoEntrar}
          onPointerLeave={aoSair}
          aria-label={`Rota: ${paradas.join(", ")}`}
          className={cn(
            "flex w-full min-w-0 items-center gap-1.5 rounded-md px-1.5 py-1 text-left text-foreground hover:bg-muted",
            className,
          )}
        >
          <MapPin aria-hidden className="size-3.5 shrink-0 text-muted-foreground" />
          <span className="truncate">{origem}</span>
          {intermediarias > 0 && (
            <>
              <ChevronRight aria-hidden className="size-3 shrink-0 text-muted-foreground" />
              <span className="shrink-0 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-muted-foreground">
                +{intermediarias}
              </span>
            </>
          )}
          {destino && (
            <>
              <ChevronRight aria-hidden className="size-3 shrink-0 text-muted-foreground" />
              <span className="truncate">{destino}</span>
            </>
          )}
        </button>
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={4}
          collisionPadding={12}
          onPointerEnter={aoEntrar}
          onPointerLeave={aoSair}
          onOpenAutoFocus={(evento) => evento.preventDefault()}
          className="z-50 w-72 rounded-lg border bg-popover p-3 text-popover-foreground shadow-lg outline-none"
        >
          <p className="mb-2 text-xs font-medium text-muted-foreground">
            Rota · {entregas.length} {entregas.length === 1 ? "entrega" : "entregas"}
          </p>
          <ol className="relative space-y-2.5">
            {/* Linha vertical ligando as paradas. */}
            <span aria-hidden className="absolute bottom-2 left-[5px] top-2 w-px bg-border" />
            {entregas.map((entrega, indice) => {
              const ultima = indice === entregas.length - 1
              return (
                <li key={indice} className="relative flex gap-3 pl-0">
                  <span
                    aria-hidden
                    className={cn(
                      "relative z-10 mt-1 size-[11px] shrink-0 rounded-full border-2 bg-popover",
                      ultima ? "border-primary bg-primary" : "border-muted-foreground/60",
                    )}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="truncate text-xs font-medium text-foreground">
                        {formatarNomeProprio(entrega.cidade)}
                        {entrega.uf ? <span className="font-normal text-muted-foreground"> · {entrega.uf.toUpperCase()}</span> : null}
                      </p>
                      {entrega.dataEntrega ? (
                        <span
                          className="shrink-0 font-mono text-[11px] tabular-nums text-muted-foreground"
                          title={formatarDataHoraPtBr(entrega.dataEntrega)}
                        >
                          {formatarHoraLocal(entrega.dataEntrega)}
                        </span>
                      ) : null}
                    </div>
                    {entrega.cliente ? (
                      <p className="truncate text-[11px] text-muted-foreground" title={entrega.cliente}>
                        {formatarNomeProprio(entrega.cliente)}
                      </p>
                    ) : null}
                  </div>
                </li>
              )
            })}
          </ol>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}
