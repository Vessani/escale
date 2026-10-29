import { ShieldAlert, ShieldCheck } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import type { AutorizacaoEstouro } from "@/lib/services/relatorios/jornada-analise"
import { partesDaAutorizacao } from "@/lib/relatorios/formato"

/**
 * Coluna "Autorizado por" dos relatórios de estouro: quem aprovou o pedido
 * de estouro pelo link do grupo, quando, quanto e por quê. Sem pedido
 * aprovado, avisa "Sem autorização". O texto vem de partesDaAutorizacao —
 * o mesmo do Excel.
 */
export function AutorizacaoEstouroCelula({ autorizacoes }: { autorizacoes: readonly AutorizacaoEstouro[] }) {
  if (autorizacoes.length === 0) {
    return (
      <Badge variant="outline" className="gap-1 border-warning/30 bg-warning/10 text-warning">
        <ShieldAlert aria-hidden className="size-3.5" />
        Sem autorização
      </Badge>
    )
  }
  return (
    <div className="space-y-1.5">
      {autorizacoes.map((a) => {
        const { quem, quando, extras, motivos, pedidoPor } = partesDaAutorizacao(a)
        return (
          <div key={a.id} className="text-xs">
            <span className="flex items-center gap-1 font-medium text-foreground">
              <ShieldCheck aria-hidden className="size-3.5 text-success" />
              {quem}
            </span>
            <span className="block text-muted-foreground tabular-nums">
              {quando && `${quando} · `}
              {extras} · {pedidoPor}
            </span>
            <span className="block max-w-56 truncate text-muted-foreground" title={motivos}>
              {motivos}
            </span>
          </div>
        )
      })}
    </div>
  )
}
