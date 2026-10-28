import type { ReactNode } from "react"
import { CheckCircle2, Clock, XCircle } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Rodape } from "@/components/layout/rodape"
import { DecisaoPorLink } from "@/components/aprovacao/decisao-por-link"
import type { SituacaoPedido } from "@/lib/services/link-aprovacao-regras"
import type { EntradaDecisaoLink } from "@/lib/validation/link-aprovacao"
import type { RespostaAcao } from "@/lib/types/types"
import { formatarDataHoraPtBr } from "@/lib/utils/date-format"

/** O que toda página pública de aprovação mostra além dos campos do pedido. */
type PedidoPorLink = {
  situacao: SituacaoPedido
  expiraEm: Date
  criadoEm: Date
  solicitadoPorNome: string | null
  decididoEm: Date | null
  decididoPorNome: string | null
  observacaoGestor: string | null
  filial: { nome: string }
}

/**
 * Moldura da página que o gestor abre pelo link do grupo (estouro, Uber):
 * cabeçalho, situação do pedido e os botões de decidir. Cada tipo de pedido
 * passa os campos dele em `children` (pares <dt>/<dd>). `pedido` null = token
 * que não existe (ou foi trocado por um link mais novo).
 */
export function PaginaAprovacao({
  titulo,
  token,
  pedido,
  decidir,
  children,
}: {
  titulo: string
  token: string
  pedido: PedidoPorLink | null
  decidir: (dados: EntradaDecisaoLink) => Promise<RespostaAcao>
  children?: ReactNode
}) {
  return (
    <main className="min-h-screen bg-background flex flex-col items-center px-4 py-8">
      <div className="w-full max-w-md flex-1 space-y-4">
        {!pedido ? (
          <Aviso
            icone={<XCircle className="w-6 h-6 text-destructive" aria-hidden />}
            titulo="Link inválido"
            texto="Este link não existe ou foi substituído por um mais novo. Peça a quem fez o pedido para enviar outro."
          />
        ) : (
          <Card className="shadow-sm">
            <CardHeader className="bg-muted border-b">
              <CardTitle className="text-lg">{titulo}</CardTitle>
              <CardDescription>
                {pedido.filial.nome} · pedido por {pedido.solicitadoPorNome ?? "escalador"} em {formatarDataHoraPtBr(pedido.criadoEm)}
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-6 space-y-5">
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">{children}</dl>

              {pedido.situacao === "PENDENTE" && (
                <DecisaoPorLink token={token} expiraEm={formatarDataHoraPtBr(pedido.expiraEm)} decidir={decidir} />
              )}
              {(pedido.situacao === "APROVADO" || pedido.situacao === "RECUSADO") && (
                <Resultado
                  icone={
                    pedido.situacao === "APROVADO" ? (
                      <CheckCircle2 className="w-5 h-5 text-success" aria-hidden />
                    ) : (
                      <XCircle className="w-5 h-5 text-destructive" aria-hidden />
                    )
                  }
                  texto={`${pedido.situacao === "APROVADO" ? "Aprovado" : "Recusado"} por ${pedido.decididoPorNome ?? "—"}`}
                  quando={pedido.decididoEm}
                  obs={pedido.observacaoGestor}
                />
              )}
              {pedido.situacao === "CANCELADO" && (
                <Resultado
                  icone={<XCircle className="w-5 h-5 text-muted-foreground" aria-hidden />}
                  texto="Pedido cancelado"
                  quando={null}
                  obs={null}
                />
              )}
              {pedido.situacao === "EXPIRADO" && (
                <Resultado
                  icone={<Clock className="w-5 h-5 text-warning" aria-hidden />}
                  texto="Link expirado — peça um novo a quem fez o pedido"
                  quando={null}
                  obs={null}
                />
              )}
            </CardContent>
          </Card>
        )}
      </div>
      <Rodape className="mt-8" />
    </main>
  )
}

function Aviso({ icone, titulo, texto }: { icone: ReactNode; titulo: string; texto: string }) {
  return (
    <Card className="shadow-sm">
      <CardContent className="pt-6 flex gap-3">
        {icone}
        <div>
          <p className="font-semibold text-foreground">{titulo}</p>
          <p className="text-sm text-muted-foreground mt-1">{texto}</p>
        </div>
      </CardContent>
    </Card>
  )
}

function Resultado({ icone, texto, quando, obs }: { icone: ReactNode; texto: string; quando: Date | null; obs: string | null }) {
  return (
    <div className="rounded-md border bg-muted p-3 text-sm">
      <p className="flex items-center gap-2 font-semibold text-foreground">
        {icone}
        {texto}
      </p>
      {quando && <p className="mt-1 text-muted-foreground">em {formatarDataHoraPtBr(quando)}</p>}
      {obs && <p className="mt-1 text-foreground/80">“{obs}”</p>}
    </div>
  )
}
