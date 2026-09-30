import { Fragment } from "react"
import { ChevronRight, MapPin } from "lucide-react"
import { paradasDaRota } from "@/lib/utils/texto"
import { cn } from "@/lib/utils"

/**
 * Rota da viagem em uma linha: "📍 Joinville › Itajai › Blumenau +2". As
 * primeiras `maximo` paradas aparecem, o resto vira um contador; a rota
 * inteira fica no tooltip. Substitui a corrente "JOINVILLE → ITAJAI → ..."
 * em maiúsculas, que estourava a largura da tabela.
 */
export function RotaDestinos({
  cidades,
  maximo = 3,
  className,
}: {
  cidades: Array<string | null | undefined>
  maximo?: number
  className?: string
}) {
  const paradas = paradasDaRota(cidades)

  if (paradas.length === 0) {
    return <span className="text-muted-foreground">—</span>
  }

  const visiveis = paradas.slice(0, maximo)
  const restantes = paradas.length - visiveis.length

  return (
    <span title={paradas.join(" → ")} className={cn("flex min-w-0 items-center gap-1.5 text-foreground", className)}>
      <MapPin aria-hidden className="size-3.5 shrink-0 text-muted-foreground" />
      <span className="truncate">
        {visiveis.map((parada, indice) => (
          <Fragment key={`${parada}-${indice}`}>
            {indice > 0 && <ChevronRight aria-hidden className="mx-0.5 inline size-3 align-[-2px] text-muted-foreground" />}
            {parada}
          </Fragment>
        ))}
      </span>
      {restantes > 0 && (
        <span className="shrink-0 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-muted-foreground">
          +{restantes}
        </span>
      )}
    </span>
  )
}
