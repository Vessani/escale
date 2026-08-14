import Link from "next/link"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { Button } from "@/components/ui/button"
import { Pencil, Route } from "lucide-react"
import { Alert } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { buscarViagensDoDashboard } from "@/lib/queries/viagens"
import { buscarMotoristasParaSelect } from "@/lib/queries/motoristas"
import { motoristaEstaDisponivelNoPeriodo } from "@/lib/services/alocacao.service"
import { serializeData } from "@/lib/serialization"
import { classeBadgeStatusViagem } from "./viagens/badge-styles"
import { STATUS_VIAGEM_OPCOES, formatarStatusViagem, parseStatusFiltro } from "@/lib/services/viagem-status.service"
import { formatarDataHoraPtBr } from "@/lib/utils/date-format"
import AtualizarSaidaReal from "./atualizar-saida-real"
import AtualizarStatusRapido from "./viagens/atualizar-status-rapido"
import AlocarMotoristasDashboard from "./alocar-motoristas-dashboard"
import QuadroDeObservacoes from "./quadro-de-observacoes"
import { buscarQuadroObservacoes } from "@/lib/queries/quadro"

async function buscarDadosDashboard(filialId: number, hoje: Date, filtroStatus: ReturnType<typeof parseStatusFiltro>) {
  const [viagens, motoristasBrutos] = await Promise.all([
    buscarViagensDoDashboard(filialId, hoje, filtroStatus),
    buscarMotoristasParaSelect(filialId),
  ])

  // Disponibilidade é calculada por viagem (exclui a própria viagem da agenda
  // de cada motorista) — mesmo critério usado em /viagens/editar/[id].
  const viagensComMotoristas = viagens.map((viagem) => {
    const motoristas = motoristasBrutos.map((motorista) => {
      const { viagens: agenda, ...dadosMotorista } = motorista
      const disponivel = motoristaEstaDisponivelNoPeriodo(
        { ...motorista, viagens: agenda.filter((v) => v.id !== viagem.id) },
        new Date(viagem.inicioPrevisto),
        new Date(viagem.fimPrevisto),
        hoje,
      )
      return { ...dadosMotorista, disponivel }
    })

    return { viagem, motoristas }
  })

  return serializeData(viagensComMotoristas)
}

type ItemDashboard = Awaited<ReturnType<typeof buscarDadosDashboard>>[number]

function cidadesDestino(item: ItemDashboard) {
  const cidades = [...new Set(item.viagem.entregas.map((entrega) => entrega.cidade).filter(Boolean))]
  return cidades.length > 0 ? cidades.join(" → ") : "-"
}

function AlocacaoCelula({ item }: { item: ItemDashboard }) {
  const { viagem, motoristas } = item

  return (
    <div className="space-y-1">
      <AlocarMotoristasDashboard
        viagemId={viagem.id}
        motoristaId={viagem.motoristaId}
        motoristaAcompanhanteId={viagem.motoristaAcompanhanteId}
        motoristas={motoristas}
        turno={viagem.turno}
        diasViagem={viagem.diasViagem}
        inicioPrevisto={viagem.inicioPrevisto}
        integracaoExigida={viagem.integracaoExigida}
      />
      {viagem.avisoInterjornada && (
        <Alert variant="warning" inline title={viagem.avisoInterjornada}>
          Interjornada
        </Alert>
      )}
    </div>
  )
}

function FrotaCelula({ item }: { item: ItemDashboard }) {
  const { viagem } = item
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        <span className="text-slate-900">{viagem.cavalo}</span>
        <span className="text-slate-500">/ {viagem.carreta}</span>
        <Link href={`/viagens/editar/${viagem.id}`} className="text-slate-400 hover:text-blue-600" title="Editar viagem">
          <Pencil className="h-3.5 w-3.5" />
        </Link>
      </div>
      {viagem.avisoFrotaIndisponivel && (
        <Alert variant="warning" inline title={viagem.avisoFrotaIndisponivel}>
          Frota indisponível
        </Alert>
      )}
    </div>
  )
}

function SaidaCelula({ item }: { item: ItemDashboard }) {
  const { viagem } = item
  return (
    <AtualizarSaidaReal
      viagemId={viagem.id}
      inicioPrevisto={viagem.inicioPrevisto}
      horarioRealSaidaInicial={viagem.horarioRealSaida}
      motivoAtrasoInicial={viagem.motivoAtraso}
    />
  )
}

function StatusCelula({ item }: { item: ItemDashboard }) {
  const { viagem } = item
  return (
    <div className="space-y-1">
      <Badge variant="outline" className={classeBadgeStatusViagem(viagem.status)}>
        {formatarStatusViagem(viagem.status)}
      </Badge>
      <AtualizarStatusRapido
        viagemId={viagem.id}
        statusAtual={viagem.status}
        inicioPrevisto={viagem.inicioPrevisto}
        fimPrevisto={viagem.fimPrevisto}
      />
    </div>
  )
}

/** Tabela para telas a partir de md; em telas menores vira lista de cards (ver ViagensEmAndamentoCards). */
function ViagensEmAndamentoTabela({ itens }: { itens: ItemDashboard[] }) {
  return (
    <div className="hidden rounded-lg border bg-white shadow-sm overflow-hidden md:block">
      <Table>
        <TableHeader className="bg-slate-50">
          <TableRow>
            <TableHead className="font-semibold text-slate-700">Motorista(s)</TableHead>
            <TableHead className="font-semibold text-slate-700">Nº Viagem</TableHead>
            <TableHead className="font-semibold text-slate-700">Frota</TableHead>
            <TableHead className="font-semibold text-slate-700">Status</TableHead>
            <TableHead className="font-semibold text-slate-700">Início Previsto</TableHead>
            <TableHead className="font-semibold text-slate-700">Saída Real</TableHead>
            <TableHead className="font-semibold text-slate-700">Destinos</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {itens.map((item) => (
            <TableRow key={item.viagem.id} className="hover:bg-slate-50">
              <TableCell className="font-medium">
                <AlocacaoCelula item={item} />
              </TableCell>
              <TableCell>{item.viagem.numViagem}</TableCell>
              <TableCell>
                <FrotaCelula item={item} />
              </TableCell>
              <TableCell>
                <StatusCelula item={item} />
              </TableCell>
              <TableCell>{formatarDataHoraPtBr(item.viagem.inicioPrevisto)}</TableCell>
              <TableCell>
                <SaidaCelula item={item} />
              </TableCell>
              <TableCell className="max-w-xs">{cidadesDestino(item)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

/** Lista em cards para telas abaixo de md; substitui a tabela (ver ViagensEmAndamentoTabela). */
function ViagensEmAndamentoCards({ itens }: { itens: ItemDashboard[] }) {
  return (
    <div className="space-y-3 md:hidden">
      {itens.map((item) => (
        <div key={item.viagem.id} className="space-y-3 rounded-lg border bg-white shadow-sm p-4">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-xs text-slate-500">
                Viagem {item.viagem.numViagem} · {item.viagem.cavalo} / {item.viagem.carreta}
              </p>
              {item.viagem.avisoFrotaIndisponivel && (
                <Alert variant="warning" inline className="mt-1" title={item.viagem.avisoFrotaIndisponivel}>
                  Frota indisponível
                </Alert>
              )}
            </div>
            <Link href={`/viagens/editar/${item.viagem.id}`} className="text-slate-400 hover:text-blue-600" title="Editar viagem">
              <Pencil className="h-4 w-4" />
            </Link>
          </div>

          <AlocacaoCelula item={item} />

          <div className="flex flex-wrap items-center gap-2">
            <StatusCelula item={item} />
          </div>

          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <div>
              <dt className="text-xs text-slate-500">Início previsto</dt>
              <dd className="font-medium text-slate-900">{formatarDataHoraPtBr(item.viagem.inicioPrevisto)}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Saída real</dt>
              <dd>
                <SaidaCelula item={item} />
              </dd>
            </div>
          </dl>

          <div>
            <p className="text-xs text-slate-500">Destinos</p>
            <p className="text-sm text-slate-900">{cidadesDestino(item)}</p>
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
  const session = await getServerSession(authOptions)
  const filialId = session!.user.filialId!
  const [itens, quadroObservacoes] = await Promise.all([
    buscarDadosDashboard(filialId, new Date(), filtroStatus),
    buscarQuadroObservacoes(filialId),
  ])

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Dashboard</h1>
          <p className="text-slate-500 mt-1">
            Quadro digital da operação: viagens de hoje em qualquer status, mais Retornando de dias anteriores e Canceladas só até a virada do dia.
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

      {itens.length === 0 ? (
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
            <Badge variant="outline">{itens.length}</Badge>
          </div>
          <ViagensEmAndamentoTabela itens={itens} />
          <ViagensEmAndamentoCards itens={itens} />
        </section>
      )}

      <QuadroDeObservacoes textoInicial={quadroObservacoes} />
    </div>
  )
}
