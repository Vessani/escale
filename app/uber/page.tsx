import Link from "next/link"
import type { Metadata } from "next"
import { CarTaxiFront, PlusCircle } from "lucide-react"
import { requireSessaoPaginaComFilial } from "@/lib/auth-guard"
import { PAPEIS_LEITURA } from "@/lib/papeis"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { buscarSolicitacoesUber } from "@/lib/services/uber.service"
import { formatarMotivoUber } from "@/lib/services/uber-regras"
import { CLASSE_SITUACAO, ROTULO_SITUACAO } from "@/lib/services/link-aprovacao-regras"
import { formatarDataHoraPtBr } from "@/lib/utils/date-format"
import { formatarNomeProprio } from "@/lib/utils/texto"
import { AcoesUber } from "@/components/uber/acoes-uber"
import { SoQuemOpera } from "@/components/layout/somente-leitura"

export const metadata: Metadata = { title: "Pedidos de Uber" }

const DIAS_NA_LISTA = 30

export default async function UberPage() {
  const { filialId } = await requireSessaoPaginaComFilial(PAPEIS_LEITURA)
  const pedidos = await buscarSolicitacoesUber(filialId, DIAS_NA_LISTA)

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Pedidos de Uber</h1>
          <p className="text-muted-foreground mt-1">
            Corridas pedidas no grupo de WhatsApp da filial — aprovação registrada aqui. Depois de aprovada, chame o Uber normalmente.
            Últimos {DIAS_NA_LISTA} dias.
          </p>
        </div>
        <SoQuemOpera>
          <Link href="/uber/novo">
            <Button>
              <PlusCircle className="w-5 h-5 mr-2" />
              Pedir Uber
            </Button>
          </Link>
        </SoQuemOpera>
      </div>

      {pedidos.length === 0 ? (
        <EmptyState
          icone={CarTaxiFront}
          titulo="Nenhum pedido"
          descricao="Nenhum Uber pedido nos últimos dias."
          acao={
            <SoQuemOpera>
              <Link href="/uber/novo">
                <Button>
                  <PlusCircle className="w-4 h-4 mr-2" />
                  Pedir Uber
                </Button>
              </Link>
            </SoQuemOpera>
          }
        />
      ) : (
        <div className="rounded-lg border bg-card shadow-sm overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Pedido em</TableHead>
                <TableHead>Motorista</TableHead>
                <TableHead>Viagem</TableHead>
                <TableHead>Trajeto</TableHead>
                <TableHead>Motivo</TableHead>
                <TableHead>Situação</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pedidos.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="whitespace-nowrap tabular-nums">
                    {formatarDataHoraPtBr(p.criadoEm)}
                    {p.solicitadoPorNome && (
                      <div className="text-xs text-muted-foreground">
                        por {p.solicitadoPorNome}
                        {p.pedidoPeloMotorista && " (motorista)"}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="font-medium">{formatarNomeProprio(p.motorista.nome)}</TableCell>
                  <TableCell className="font-mono tabular-nums">{p.viagem?.numViagem ?? "—"}</TableCell>
                  <TableCell className="max-w-72">
                    <div className="truncate" title={p.origem}>
                      {p.origem}
                    </div>
                    <div className="truncate text-muted-foreground" title={p.destino}>
                      → {p.destino}
                    </div>
                  </TableCell>
                  <TableCell className="whitespace-nowrap">{formatarMotivoUber(p.motivo)}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={CLASSE_SITUACAO[p.situacao]}>
                      {ROTULO_SITUACAO[p.situacao]}
                    </Badge>
                    {p.decididoEm && (
                      <div className="text-xs text-muted-foreground mt-1 tabular-nums">
                        {p.decididoPorNome} · {formatarDataHoraPtBr(p.decididoEm)}
                      </div>
                    )}
                    {p.observacaoGestor && (
                      <div className="text-xs text-muted-foreground max-w-48 truncate" title={p.observacaoGestor}>
                        “{p.observacaoGestor}”
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {(p.situacao === "PENDENTE" || p.situacao === "EXPIRADO") && (
                      <AcoesUber id={p.id} motorista={formatarNomeProprio(p.motorista.nome)} />
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
