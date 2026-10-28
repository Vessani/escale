import { ShieldAlert, ShieldCheck } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { formatarMinutos, formatarMotivos } from "@/lib/services/estouro-jornada-regras"
import type { AutorizacaoEstouro } from "@/lib/services/relatorios/jornada-analise"
import { formatarDiaCurto } from "@/lib/relatorios/formato"
import { formatarHoraLocal } from "@/lib/utils/date-format"

/**
 * Coluna "Autorizado por" dos relatórios de estouro: quem aprovou o pedido
 * de estouro pelo link do grupo, quando, quanto e por quê. Sem pedido
 * aprovado, avisa "Sem autorização".
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
      {autorizacoes.map((a) => (
        <div key={a.id} className="text-xs">
          <span className="flex items-center gap-1 font-medium text-foreground">
            <ShieldCheck aria-hidden className="size-3.5 text-success" />
            {a.decididoPorNome ?? "—"}
          </span>
          <span className="block text-muted-foreground tabular-nums">
            {a.decididoEm && `${formatarDiaCurto(a.decididoEm)} ${formatarHoraLocal(a.decididoEm)} · `}+{formatarMinutos(a.minutosExtras)}
            {a.pedidoPeloMotorista ? " · pelo motorista" : " · pelo escalador"}
          </span>
          <span className="block max-w-56 truncate text-muted-foreground" title={formatarMotivos(a.motivos)}>
            {formatarMotivos(a.motivos)}
          </span>
        </div>
      ))}
    </div>
  )
}
