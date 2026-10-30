import Link from "next/link"
import type { Metadata } from "next"
import { BedDouble, PlusCircle } from "lucide-react"
import { requireSessaoPaginaComFilial } from "@/lib/auth-guard"
import { PAPEIS_LEITURA } from "@/lib/papeis"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { buscarSolicitacoesHotel } from "@/lib/services/hotel.service"
import { formatarDataPernoite } from "@/lib/services/hotel-regras"
import { CLASSE_SITUACAO, ROTULO_SITUACAO } from "@/lib/services/link-aprovacao-regras"
import { formatarDataHoraPtBr } from "@/lib/utils/date-format"
import { formatarNomeProprio } from "@/lib/utils/texto"
import { AcoesHotel } from "@/components/hotel/acoes-hotel"
import { SoQuemOpera } from "@/components/layout/somente-leitura"
import { CelulaViagemDoPedido } from "@/components/aprovacao/pagina-aprovacao"

export const metadata: Metadata = { title: "Pedidos de hotel" }

const DIAS_NA_LISTA = 30

export default async function HotelPage() {
  const { filialId } = await requireSessaoPaginaComFilial(PAPEIS_LEITURA)
  const pedidos = await buscarSolicitacoesHotel(filialId, DIAS_NA_LISTA)

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Pedidos de hotel</h1>
          <p className="text-muted-foreground mt-1">
            Hotéis de pernoite pedidos no grupo de WhatsApp da filial — aprovação registrada aqui. Depois de aprovado, faça a reserva
            normalmente. Últimos {DIAS_NA_LISTA} dias.
          </p>
        </div>
        <SoQuemOpera>
          <Link href="/hotel/novo">
            <Button>
              <PlusCircle className="w-5 h-5 mr-2" />
              Pedir hotel
            </Button>
          </Link>
        </SoQuemOpera>
      </div>

      {pedidos.length === 0 ? (
        <EmptyState
          icone={BedDouble}
          titulo="Nenhum pedido"
          descricao="Nenhum hotel pedido nos últimos dias."
          acao={
            <SoQuemOpera>
              <Link href="/hotel/novo">
                <Button>
                  <PlusCircle className="w-4 h-4 mr-2" />
                  Pedir hotel
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
                <TableHead>Pernoite</TableHead>
                <TableHead>Cidade</TableHead>
                <TableHead>Hotel</TableHead>
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
                  <TableCell className="font-mono tabular-nums whitespace-nowrap">
                    <CelulaViagemDoPedido viagem={p.viagem} />
                  </TableCell>
                  <TableCell className="whitespace-nowrap tabular-nums">{formatarDataPernoite(p.dataPernoite)}</TableCell>
                  <TableCell className="max-w-48 truncate font-medium" title={p.cidade}>
                    {p.cidade}
                  </TableCell>
                  <TableCell className="max-w-72 truncate" title={p.nomeHotel}>
                    {p.nomeHotel}
                  </TableCell>
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
                      <AcoesHotel id={p.id} motorista={formatarNomeProprio(p.motorista.nome)} />
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
