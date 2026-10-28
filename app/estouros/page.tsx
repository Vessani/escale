import Link from "next/link"
import type { Metadata } from "next"
import { Hourglass, PlusCircle } from "lucide-react"
import { requireSessaoPaginaComFilial } from "@/lib/auth-guard"
import { PAPEIS_LEITURA } from "@/lib/papeis"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { buscarEstouros } from "@/lib/services/estouro-jornada.service"
import { formatarMinutos, formatarMotivos } from "@/lib/services/estouro-jornada-regras"
import { CLASSE_SITUACAO, ROTULO_SITUACAO } from "@/lib/services/link-aprovacao-regras"
import { formatarDataHoraPtBr } from "@/lib/utils/date-format"
import { formatarNomeProprio } from "@/lib/utils/texto"
import { AcoesEstouro } from "@/components/estouro/acoes-estouro"
import { SoQuemOpera } from "@/components/layout/somente-leitura"

export const metadata: Metadata = { title: "Estouros de jornada" }

const DIAS_NA_LISTA = 30

export default async function EstourosPage() {
  const { filialId } = await requireSessaoPaginaComFilial(PAPEIS_LEITURA)
  const estouros = await buscarEstouros(filialId, DIAS_NA_LISTA)

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Estouros de jornada</h1>
          <p className="text-muted-foreground mt-1">
            Pedidos de hora extra enviados no grupo de WhatsApp da filial — aprovação registrada aqui. Últimos {DIAS_NA_LISTA} dias.
          </p>
        </div>
        <SoQuemOpera>
          <Link href="/estouros/novo">
            <Button>
              <PlusCircle className="w-5 h-5 mr-2" />
              Pedir estouro
            </Button>
          </Link>
        </SoQuemOpera>
      </div>

      {estouros.length === 0 ? (
        <EmptyState
          icone={Hourglass}
          titulo="Nenhum pedido"
          descricao="Nenhum estouro de jornada pedido nos últimos dias."
          acao={
            <SoQuemOpera>
              <Link href="/estouros/novo">
                <Button>
                  <PlusCircle className="w-4 h-4 mr-2" />
                  Pedir estouro
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
                <TableHead>Extra</TableHead>
                <TableHead>Motivos</TableHead>
                <TableHead>Situação</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {estouros.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="whitespace-nowrap tabular-nums">
                    {formatarDataHoraPtBr(e.criadoEm)}
                    {e.solicitadoPorNome && (
                      <div className="text-xs text-muted-foreground">
                        por {e.solicitadoPorNome}
                        {e.pedidoPeloMotorista && " (motorista)"}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="font-medium">{formatarNomeProprio(e.motorista.nome)}</TableCell>
                  <TableCell className="font-mono tabular-nums">{e.viagem?.numViagem ?? "—"}</TableCell>
                  <TableCell className="tabular-nums">{formatarMinutos(e.minutosExtras)}</TableCell>
                  <TableCell className="max-w-64">{formatarMotivos(e.motivos)}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={CLASSE_SITUACAO[e.situacao]}>
                      {ROTULO_SITUACAO[e.situacao]}
                    </Badge>
                    {e.decididoEm && (
                      <div className="text-xs text-muted-foreground mt-1 tabular-nums">
                        {e.decididoPorNome} · {formatarDataHoraPtBr(e.decididoEm)}
                      </div>
                    )}
                    {e.observacaoGestor && (
                      <div className="text-xs text-muted-foreground max-w-48 truncate" title={e.observacaoGestor}>
                        “{e.observacaoGestor}”
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {(e.situacao === "PENDENTE" || e.situacao === "EXPIRADO") && (
                      <AcoesEstouro id={e.id} motorista={formatarNomeProprio(e.motorista.nome)} />
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
