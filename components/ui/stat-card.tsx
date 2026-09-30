import * as React from "react"
import type { LucideIcon } from "lucide-react"

import { cn } from "@/lib/utils"

/** Card de indicador: rótulo pequeno, número grande e ícone discreto no canto. `classeValor` colore o número (ex: `text-warning`). */
function StatCard({
  rotulo,
  valor,
  icone: Icone,
  classeValor,
  className,
  ...props
}: Omit<React.ComponentProps<"div">, "children"> & {
  rotulo: string
  valor: React.ReactNode
  icone: LucideIcon
  classeValor?: string
}) {
  return (
    <div
      data-slot="stat-card"
      className={cn("relative rounded-lg border bg-card p-4 text-card-foreground shadow-sm", className)}
      {...props}
    >
      <Icone aria-hidden="true" className="absolute right-4 top-4 size-4 text-muted-foreground/60" />
      <p className="text-xs font-medium text-muted-foreground">{rotulo}</p>
      <p className={cn("mt-1 text-3xl font-semibold tabular-nums", classeValor)}>{valor}</p>
    </div>
  )
}

export { StatCard }
