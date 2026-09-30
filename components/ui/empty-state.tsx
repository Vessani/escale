import * as React from "react"
import type { LucideIcon } from "lucide-react"

import { cn } from "@/lib/utils"

/** Estado vazio de listagem: ícone num círculo, título curto, descrição opcional e uma ação (ex: botão "Nova viagem") quando fizer sentido. */
function EmptyState({
  icone: Icone,
  titulo,
  descricao,
  acao,
  classeIcone,
  className,
}: {
  icone: LucideIcon
  titulo: string
  descricao?: React.ReactNode
  acao?: React.ReactNode
  classeIcone?: string
  className?: string
}) {
  return (
    <div
      data-slot="empty-state"
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-lg border bg-card p-12 text-center shadow-sm",
        className,
      )}
    >
      <div className="grid size-20 place-items-center rounded-full bg-muted">
        <Icone aria-hidden="true" className={cn("size-10 text-muted-foreground", classeIcone)} />
      </div>
      <div className="space-y-1">
        <p className="font-medium text-foreground">{titulo}</p>
        {descricao && <p className="text-sm text-muted-foreground">{descricao}</p>}
      </div>
      {acao}
    </div>
  )
}

export { EmptyState }
