import Link from "next/link"
import { Button } from "@/components/ui/button"
import { AlertTriangle, Route } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { buscarViagensDoDashboard } from "@/lib/queries/viagens"
import { classeBadgeStatusViagem } from "./viagens/badge-styles"
import { STATUS_VIAGEM_OPCOES, formatarStatusViagem, parseStatusFiltro } from "@/lib/services/viagem-status.service"
import { formatarDataHoraPtBr } from "@/lib/utils/date-format"
import AtualizarSaidaReal from "./atualizar-saida-real"

type Viagem = Awaited<ReturnType<typeof buscarViagensDoDashboard>>[number]

function cidadesDestino(viagem: Viagem) {
  const cidades = [...new Set(viagem.entregas.map((entrega) => entrega.cidade).filter(Boolean))]
  return cidades.length > 0 ? cidades.join(" → ") : "-"
}

function MotoristaCelula({ viagem, className }: { viagem: Viagem; className?: string }) {
  return (
    <div className="space-y-1">
      <Link href={`/viagens/editar/${viagem.id}`} className={className ?? "hover:text-blue-700"}>
        {viagem.motorista?.nome ?? "Não alocado"}
      </Link>
      {viagem.avisoInterjornada && (
        <div className="flex items-center gap-1 text-xs text-amber-700" title={viagem.avisoInterjornada}>
          <AlertTriangle className="h-3 w-3 shrink-0" />
          <span>Interjornada</span>
        </div>
      )}
    </div>
  )
}

function SaidaCelula({ viagem }: { viagem: Viagem }) {
  return (
    <AtualizarSaidaReal
      viagemId={viagem.id}
      inicioPrevisto={viagem.inicioPrevisto}
      horarioRealSaidaInicial={viagem.horarioRealSaida}
      motivoAtrasoInicial={viagem.motivoAtraso}
    />
  )
}

/** Tabela para telas a partir de md; em telas menores vira lista de cards (ver ViagensEmAndamentoCards). */
function ViagensEmAndamentoTabela({ viagens }: { viagens: Viagem[] }) {
  return (
    <div className="hidden rounded-lg border bg-white shadow-sm overflow-hidden md:block">
      <Table>
        <TableHeader className="bg-slate-50">
          <TableRow>
            <TableHead className="font-semibold text-slate-700">Motorista</TableHead>
            <TableHead className="font-semibold text-slate-700">Nº Viagem</TableHead>
            <TableHead className="font-semibold text-slate-700">Frota</TableHead>
            <TableHead className="font-semibold text-slate-700">Status</TableHead>
            <TableHead className="font-semibold text-slate-700">Início Previsto</TableHead>
            <TableHead className="font-semibold text-slate-700">Saída Real</TableHead>
            <TableHead className="font-semibold text-slate-700">Destinos</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {viagens.map((viagem) => (
            <TableRow key={viagem.id} className="hover:bg-slate-50">
              <TableCell className="font-medium">
                <MotoristaCelula viagem={viagem} />
              </TableCell>
              <TableCell>{viagem.numViagem}</TableCell>
              <TableCell>
                <span className="text-slate-900">{viagem.cavalo}</span>
                <span className="text-slate-500"> / {viagem.carreta}</span>
              </TableCell>
              <TableCell>
                <Badge variant="outline" className={classeBadgeStatusViagem(viagem.status)}>
                  {formatarStatusViagem(viagem.status)}
                </Badge>
              </TableCell>
              <TableCell>{formatarDataHoraPtBr(viagem.inicioPrevisto)}</TableCell>
              <TableCell>
                <SaidaCelula viagem={viagem} />
              </TableCell>
              <TableCell className="max-w-xs">{cidadesDestino(viagem)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

/** Lista em cards para telas abaixo de md; substitui a tabela (ver ViagensEmAndamentoTabela). */
function ViagensEmAndamentoCards({ viagens }: { viagens: Viagem[] }) {
  return (
    <div className="space-y-3 md:hidden">
      {viagens.map((viagem) => (
        <div key={viagem.id} className="space-y-3 rounded-lg border bg-white shadow-sm p-4">
          <div className="flex items-start justify-between gap-2">
            <div>
              <MotoristaCelula viagem={viagem} className="font-semibold text-slate-900 hover:text-blue-700" />
              <p className="text-xs text-slate-500">
                Viagem {viagem.numViagem} · {viagem.cavalo} / {viagem.carreta}
              </p>
            </div>
            <Badge variant="outline" className={classeBadgeStatusViagem(viagem.status)}>
              {formatarStatusViagem(viagem.status)}
            </Badge>
          </div>

          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <div>
              <dt className="text-xs text-slate-500">Início previsto</dt>
              <dd className="font-medium text-slate-900">{formatarDataHoraPtBr(viagem.inicioPrevisto)}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Saída real</dt>
              <dd>
                <SaidaCelula viagem={viagem} />
              </dd>
            </div>
          </dl>

          <div>
            <p className="text-xs text-slate-500">Destinos</p>
            <p className="text-sm text-slate-900">{cidadesDestino(viagem)}</p>
          </div>
        </div>
      ))}
    </div>
  )
}

type SearchParamsInput = {
  status?: string
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParamsInput>
}) {
  const parametros = (await searchParams) ?? {}
  const filtroStatus = parseStatusFiltro(parametros.status)
  const viagens = await buscarViagensDoDashboard(new Date(), filtroStatus)

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Dashboard</h1>
          <p className="text-slate-500 mt-1">
            Viagens de hoje em qualquer status, mais qualquer viagem ainda Retornando de dias anteriores.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/">
            <Button variant={filtroStatus === "TODOS" ? "default" : "outline"}>Todos</Button>
          </Link>
          {STATUS_VIAGEM_OPCOES.map((status) => (
            <Link key={status.valor} href={`/?status=${status.valor}`}>
              <Button variant={filtroStatus === status.valor ? "default" : "outline"}>
                {status.label}
              </Button>
            </Link>
          ))}
        </div>
      </div>

      {viagens.length === 0 ? (
        <div className="border rounded-lg bg-white shadow-sm p-12">
          <div className="flex flex-col items-center justify-center text-slate-500">
            <Route className="w-8 h-8 text-slate-300 mb-2" />
            <p>Nenhuma viagem encontrada para este filtro.</p>
          </div>
        </div>
      ) : (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-slate-900">
              {filtroStatus === "TODOS" ? "Hoje" : `Status: ${formatarStatusViagem(filtroStatus)}`}
            </h2>
            <Badge variant="outline">{viagens.length}</Badge>
          </div>
          <ViagensEmAndamentoTabela viagens={viagens} />
          <ViagensEmAndamentoCards viagens={viagens} />
        </section>
      )}
    </div>
  )
}
