import type { ReactNode } from "react"
import Link from "next/link"
import { ArrowLeft, type LucideIcon } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { CLASSE_SITUACAO, ROTULO_SITUACAO, type SituacaoPedido } from "@/lib/services/link-aprovacao-regras"
import { formatarDataHoraPtBr } from "@/lib/utils/date-format"

/**
 * Moldura das telas do motorista que pedem algo por link (estouro, Uber):
 * volta pra Minhas viagens, o formulário e a lista dos pedidos recentes dele.
 */
export function TelaPedidoMotorista({
  icone: Icone,
  titulo,
  descricao,
  formulario,
  diasNaLista,
  children,
}: {
  icone: LucideIcon
  titulo: string
  descricao: ReactNode
  formulario: ReactNode
  diasNaLista: number
  /** Os cartões dos pedidos (CartaoMeuPedido); vazio esconde a lista. */
  children?: ReactNode[]
}) {
  return (
    <>
      <Link href="/minhas-viagens" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
        <ArrowLeft className="size-4" aria-hidden /> Minhas viagens
      </Link>

      <section className="space-y-3 rounded-xl border bg-card p-4 shadow-sm">
        <h1 className="flex items-center gap-2 text-base font-semibold">
          <Icone className="size-5 text-primary" aria-hidden />
          {titulo}
        </h1>
        <p className="text-sm text-muted-foreground">{descricao}</p>
        {formulario}
      </section>

      {children && children.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Meus pedidos (últimos {diasNaLista} dias)</h2>
          {children}
        </section>
      )}
    </>
  )
}

/**
 * Um pedido na lista do motorista: o que foi pedido (`titulo`, `detalhes`),
 * a situação, quem decidiu e, enquanto não houver resposta, as ações
 * (reenviar o link, cancelar).
 */
export function CartaoMeuPedido({
  pedido,
  titulo,
  detalhes,
  acoes,
}: {
  pedido: {
    situacao: SituacaoPedido
    numViagem?: string | null
    decididoEm: Date | null
    decididoPorNome: string | null
    observacaoGestor: string | null
  }
  titulo: ReactNode
  detalhes: ReactNode
  acoes: ReactNode
}) {
  return (
    <div className="space-y-1.5 rounded-xl border bg-card p-4 text-sm shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-semibold tabular-nums">
          {titulo}
          {pedido.numViagem && <span className="ml-2 font-mono font-normal text-muted-foreground">{pedido.numViagem}</span>}
        </span>
        <Badge variant="outline" className={CLASSE_SITUACAO[pedido.situacao]}>
          {ROTULO_SITUACAO[pedido.situacao]}
        </Badge>
      </div>
      {detalhes}
      {pedido.decididoEm && (
        <p className="text-muted-foreground">
          {pedido.decididoPorNome} em {formatarDataHoraPtBr(pedido.decididoEm)}
          {pedido.observacaoGestor && <span className="block text-foreground/80">“{pedido.observacaoGestor}”</span>}
        </p>
      )}
      {(pedido.situacao === "PENDENTE" || pedido.situacao === "EXPIRADO") && <div className="flex justify-end">{acoes}</div>}
    </div>
  )
}
