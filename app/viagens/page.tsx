import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { AlertTriangle, Download, PlusCircle, Truck } from "lucide-react"
import { buscarViagens } from "@/lib/queries/viagens"
import { STATUS_VIAGEM_OPCOES, formatarStatusViagem, parseStatusFiltro } from "@/lib/services/viagem-status.service"
import AtualizarStatusRapido from "./atualizar-status-rapido"
import ExcluirViagemButton from "./excluir-viagem-button"
import { classeBadgeStatusViagem, classeBadgeTurno } from "./badge-styles"
import { formatarDataHoraPtBr } from "@/lib/utils/date-format"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

type Viagem = Awaited<ReturnType<typeof buscarViagens>>[number]

function MotoristaCelula({ viagem }: { viagem: Viagem }) {
  if (!viagem.motorista) {
    return (
      <Badge variant="outline" className="border-amber-200 bg-amber-100 text-amber-800 hover:bg-amber-100">
        Pendente Alocação
      </Badge>
    )
  }

  return (
    <div className="space-y-1">
      <span className="text-slate-900 font-medium">{viagem.motorista.nome}</span>
      {viagem.avisoInterjornada && (
        <div className="flex items-center gap-1 text-xs text-amber-700" title={viagem.avisoInterjornada}>
          <AlertTriangle className="h-3 w-3 shrink-0" />
          <span>Interjornada</span>
        </div>
      )}
    </div>
  )
}

function AcoesViagem({ viagem }: { viagem: Viagem }) {
  return (
    <div className="flex flex-wrap justify-end gap-2">
      <Link href={`/api/viagens/${viagem.id}/pdf`}>
        <Button variant="outline" size="sm">
          <Download className="h-4 w-4 mr-2" />
          Download
        </Button>
      </Link>
      <Link href={`/viagens/editar/${viagem.id}`}>
        <Button variant="outline" size="sm">Editar</Button>
      </Link>
      <ExcluirViagemButton viagemId={viagem.id} numeroViagem={viagem.numViagem} />
    </div>
  )
}

/** Tabela para telas a partir de md; em telas menores vira lista de cards (ver ViagensCards). */
function ViagensTabela({ viagens }: { viagens: Viagem[] }) {
  return (
    <div className="hidden rounded-lg border bg-white shadow-sm overflow-hidden md:block">
      <Table>
        <TableHeader className="bg-slate-50">
          <TableRow>
            <TableHead className="font-semibold text-slate-700">Nº Viagem</TableHead>
            <TableHead className="font-semibold text-slate-700">Início Previsto</TableHead>
            <TableHead className="font-semibold text-slate-700">Fim Previsto</TableHead>
            <TableHead className="font-semibold text-slate-700">Turno</TableHead>
            <TableHead className="font-semibold text-slate-700">Status</TableHead>
            <TableHead className="font-semibold text-slate-700">Caminhão</TableHead>
            <TableHead className="font-semibold text-slate-700">Motorista</TableHead>
            <TableHead className="font-semibold text-slate-700 text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {viagens.map((viagem: Viagem) => (
            <TableRow key={viagem.id} className="hover:bg-slate-50">
              <TableCell className="font-medium">{viagem.numViagem}</TableCell>
              <TableCell>{formatarDataHoraPtBr(viagem.inicioPrevisto)}</TableCell>
              <TableCell>{formatarDataHoraPtBr(viagem.fimPrevisto)}</TableCell>
              <TableCell>
                <Badge variant="outline" className={classeBadgeTurno(viagem.turno)}>
                  {viagem.turno}
                </Badge>
              </TableCell>
              <TableCell>
                <div className="space-y-1">
                  <Badge variant="outline" className={classeBadgeStatusViagem(viagem.status)}>
                    {formatarStatusViagem(viagem.status)}
                  </Badge>
                  <AtualizarStatusRapido viagemId={viagem.id} statusAtual={viagem.status} />
                </div>
              </TableCell>
              <TableCell>
                <div className="text-sm">
                  <span className="font-medium text-slate-900">{viagem.cavalo}</span>
                  <span className="text-slate-500 ml-1">/ {viagem.carreta}</span>
                </div>
              </TableCell>
              <TableCell>
                <MotoristaCelula viagem={viagem} />
              </TableCell>
              <TableCell className="text-right">
                <AcoesViagem viagem={viagem} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

/** Lista em cards para telas abaixo de md; substitui a tabela (ver ViagensTabela). */
function ViagensCards({ viagens }: { viagens: Viagem[] }) {
  return (
    <div className="space-y-3 md:hidden">
      {viagens.map((viagem) => (
        <div key={viagem.id} className="space-y-3 rounded-lg border bg-white shadow-sm p-4">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="font-semibold text-slate-900">{viagem.numViagem}</p>
              <p className="text-xs text-slate-500">
                {formatarDataHoraPtBr(viagem.inicioPrevisto)} até {formatarDataHoraPtBr(viagem.fimPrevisto)}
              </p>
            </div>
            <Badge variant="outline" className={classeBadgeTurno(viagem.turno)}>
              {viagem.turno}
            </Badge>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className={classeBadgeStatusViagem(viagem.status)}>
              {formatarStatusViagem(viagem.status)}
            </Badge>
            <AtualizarStatusRapido viagemId={viagem.id} statusAtual={viagem.status} />
          </div>

          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <div>
              <dt className="text-xs text-slate-500">Caminhão</dt>
              <dd className="font-medium text-slate-900">{viagem.cavalo} / {viagem.carreta}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Motorista</dt>
              <dd><MotoristaCelula viagem={viagem} /></dd>
            </div>
          </dl>

          <AcoesViagem viagem={viagem} />
        </div>
      ))}
    </div>
  )
}

type SearchParamsInput = {
  status?: string
}

export default async function ViagensPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParamsInput>
}) {
  const parametros = (await searchParams) ?? {}
  const filtroStatus = parseStatusFiltro(parametros.status)
  const viagens = await buscarViagens()
  const viagensFiltradas =
    filtroStatus === "TODOS" ? viagens : viagens.filter((viagem) => viagem.status === filtroStatus)

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Gestão de Viagens</h1>
          <p className="text-slate-500 mt-1">Use os filtros para acompanhar viagens por status e gerenciar as ações.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/viagens">
            <Button variant={filtroStatus === "TODOS" ? "default" : "outline"}>Todos</Button>
          </Link>
          {STATUS_VIAGEM_OPCOES.map((status) => (
            <Link key={status.valor} href={`/viagens?status=${status.valor}`}>
              <Button variant={filtroStatus === status.valor ? "default" : "outline"}>
                {status.label}
              </Button>
            </Link>
          ))}
          <Link href="/viagens/alocacao">
            <Button variant="outline">Alocação Manual</Button>
          </Link>
          <Link href="/viagens/nova">
            <Button className="bg-blue-600 hover:bg-blue-700 text-white">
              <PlusCircle className="w-5 h-5 mr-2" />
              Nova Viagem
            </Button>
          </Link>
        </div>
      </div>

      {viagensFiltradas.length === 0 ? (
        <div className="border rounded-lg bg-white shadow-sm p-12">
          <div className="flex flex-col items-center justify-center text-slate-500">
            <Truck className="w-8 h-8 text-slate-300 mb-2" />
            <p>Nenhuma viagem encontrada para este filtro.</p>
          </div>
        </div>
      ) : (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-slate-900">
              {filtroStatus === "TODOS" ? "Todas as viagens" : `Status: ${formatarStatusViagem(filtroStatus)}`}
            </h2>
            <Badge variant="outline">{viagensFiltradas.length}</Badge>
          </div>
          <ViagensTabela viagens={viagensFiltradas} />
          <ViagensCards viagens={viagensFiltradas} />
        </section>
      )}
    </div>
  )
}