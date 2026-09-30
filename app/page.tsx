import Link from "next/link"
import { requireSessaoPaginaComFilial } from "@/lib/auth-guard"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"
import { Input } from "@/components/ui/input"
import { CalendarDays, CheckCircle2, Info, PlayCircle, PlusCircle, Route, UserX } from "lucide-react"
import { Alert } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { StatCard } from "@/components/ui/stat-card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { buscarViagensDoDashboard } from "@/lib/queries/viagens"
import type { StatusViagem } from "@prisma/client"
import { NomeMotorista } from "@/components/motorista/icone-tipo-motorista"
import { STATUS_ALTERAVEIS_NO_DASHBOARD, organizarViagensDoDashboard, viagemEncerrada } from "@/lib/services/dashboard.service"
import { cn } from "@/lib/utils"
import { serializeData } from "@/lib/serialization"
import { STATUS_VIAGEM_OPCOES, formatarStatusViagem, parseStatusFiltro, type FiltroStatusViagem } from "@/lib/services/viagem-status.service"
import { formatDateForDateInput, formatarDataHoraPtBr, formatarHoraLocal, inicioDoDia, parseDataLocal } from "@/lib/utils/date-format"
import { RotaDestinos } from "@/components/viagem/rota-destinos"
import AtualizarSaidaReal from "./atualizar-saida-real"
import AtualizarStatusRapido from "./viagens/atualizar-status-rapido"
import QuadroDeObservacoes from "./quadro-de-observacoes"
import { buscarQuadroObservacoes } from "@/lib/queries/quadro"
import { formatarCodigoFrota } from "@/lib/services/frota-regras"
import { LegendaMotoristas } from "@/components/motorista/legenda-motoristas"

async function buscarDadosDashboard(filialId: number, hoje: Date) {
  const viagens = await buscarViagensDoDashboard(filialId, hoje)
  return serializeData(viagens.map((viagem) => ({ viagem })))
}

type ItemDashboard = Awaited<ReturnType<typeof buscarDadosDashboard>>[number]

function entregasDaViagem(item: ItemDashboard) {
  return item.viagem.entregas
}

/**
 * Início previsto compacto: só a hora quando a viagem é do dia mostrado
 * (o caso comum no painel), com a data na frente quando é de outro dia
 * (ex: "Retornando" que saiu ontem).
 */
function InicioPrevisto({ inicio, diaMostrado }: { inicio: string | Date; diaMostrado: string }) {
  const mesmoDia = formatDateForDateInput(inicioDoDia(new Date(inicio))) === diaMostrado
  const completo = formatarDataHoraPtBr(inicio)

  return (
    <span title={completo} className="font-mono tabular-nums text-foreground">
      {mesmoDia ? formatarHoraLocal(inicio) : completo.replace(/\/\d{4},/, "")}
    </span>
  )
}

/**
 * Motorista(s) só pra leitura — o Dashboard é painel de acompanhamento;
 * alocar e trocar motorista é na Gestão de Viagens.
 */
function MotoristaCelula({ item }: { item: ItemDashboard }) {
  const { viagem } = item

  return (
    <div className="space-y-0.5">
      {viagem.motorista ? (
        <NomeMotorista nome={viagem.motorista.nome} tipo={viagem.motorista.tipo} className="font-medium text-foreground" />
      ) : (
        <Badge variant="warning">Sem motorista</Badge>
      )}
      {viagem.motoristaAcompanhante && (
        <p className="flex items-center gap-1 text-xs text-muted-foreground">
          <span aria-hidden>+</span>
          <span className="sr-only">Acompanhante:</span>
          <NomeMotorista nome={viagem.motoristaAcompanhante.nome} tipo={viagem.motoristaAcompanhante.tipo} />
        </p>
      )}
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
    <div className="space-y-0.5">
      <p className="font-mono font-medium tabular-nums text-foreground">{viagem.numViagem}</p>
      <p className="font-mono text-[11px] tabular-nums text-muted-foreground" title="Cavalo / carreta">
        {formatarCodigoFrota(viagem.cavalo)} / {formatarCodigoFrota(viagem.carreta)}
      </p>
      {viagem.avisoFrotaIndisponivel && (
        <Alert variant="warning" inline title={viagem.avisoFrotaIndisponivel}>
          Indisponível
        </Alert>
      )}
      {viagem.avisoFrotaProdutoIncompativel && (
        <Alert variant="warning" inline title={viagem.avisoFrotaProdutoIncompativel}>
          Outro produto
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
      <AtualizarStatusRapido
        viagemId={viagem.id}
        statusAtual={viagem.status}
        inicioPrevisto={viagem.inicioPrevisto}
        fimPrevisto={viagem.fimPrevisto}
        opcoesPermitidas={STATUS_ALTERAVEIS_NO_DASHBOARD}
      />
    </div>
  )
}

/** Tabela para telas a partir de md; em telas menores vira lista de cards (ver ViagensEmAndamentoCards). */
function ViagensEmAndamentoTabela({ itens, diaMostrado }: { itens: ItemDashboard[]; diaMostrado: string }) {
  // table-fixed + larguras por coluna: a tabela sempre cabe na largura da
  // tela (sem barra de rolagem lateral) — o que não cabe numa coluna é
  // truncado, com o texto completo no tooltip.
  return (
    <div className="hidden rounded-lg border bg-card shadow-sm overflow-hidden md:block">
      <Table className="table-fixed" containerClassName="max-h-[70vh] overflow-y-auto overflow-x-hidden">
        <colgroup>
          <col className="w-[22%]" />
          <col className="w-[13%]" />
          <col className="w-[14%]" />
          <col className="w-[9%]" />
          <col className="w-[17%]" />
          <col />
        </colgroup>
        <TableHeader className="sticky top-0 z-10 bg-muted">
          <TableRow>
            <TableHead>Motorista(s)</TableHead>
            <TableHead>Viagem</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Início</TableHead>
            <TableHead>Saída real</TableHead>
            <TableHead>Destinos</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {itens.map((item) => (
            <TableRow key={item.viagem.id} className={cn(viagemEncerrada(item.viagem.status) && "opacity-60")}>
              <TableCell className="overflow-hidden">
                <MotoristaCelula item={item} />
              </TableCell>
              <TableCell className="overflow-hidden">
                <FrotaCelula item={item} />
              </TableCell>
              <TableCell>
                <StatusCelula item={item} />
              </TableCell>
              <TableCell>
                <InicioPrevisto inicio={item.viagem.inicioPrevisto} diaMostrado={diaMostrado} />
              </TableCell>
              <TableCell className="overflow-hidden">
                <SaidaCelula item={item} />
              </TableCell>
              <TableCell className="overflow-hidden">
                <RotaDestinos entregas={entregasDaViagem(item)} />
              </TableCell>
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
        <div
          key={item.viagem.id}
          className={cn("space-y-3 rounded-lg border bg-card shadow-sm p-4", viagemEncerrada(item.viagem.status) && "opacity-60")}
        >
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-xs text-muted-foreground">
                Viagem <span className="font-mono tabular-nums">{item.viagem.numViagem}</span> · <span className="font-mono tabular-nums">{formatarCodigoFrota(item.viagem.cavalo)} / {formatarCodigoFrota(item.viagem.carreta)}</span>
              </p>
              {item.viagem.avisoFrotaIndisponivel && (
                <Alert variant="warning" inline className="mt-1" title={item.viagem.avisoFrotaIndisponivel}>
                  Frota indisponível
                </Alert>
              )}
              {item.viagem.avisoFrotaProdutoIncompativel && (
                <Alert variant="warning" inline className="mt-1" title={item.viagem.avisoFrotaProdutoIncompativel}>
                  Frota de outro produto
                </Alert>
              )}
            </div>
          </div>

          <MotoristaCelula item={item} />

          <div className="flex flex-wrap items-center gap-2">
            <StatusCelula item={item} />
          </div>

          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <div>
              <dt className="text-xs text-muted-foreground">Início previsto</dt>
              <dd className="font-mono font-medium tabular-nums text-foreground">{formatarDataHoraPtBr(item.viagem.inicioPrevisto)}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Saída real</dt>
              <dd>
                <SaidaCelula item={item} />
              </dd>
            </div>
          </dl>

          <div>
            <p className="text-xs text-muted-foreground">Destinos</p>
            <RotaDestinos entregas={entregasDaViagem(item)} className="px-0 text-sm" />
          </div>
        </div>
      ))}
    </div>
  )
}

type SearchParamsInput = {
  status?: string
  data?: string
}

/** YYYY-MM-DD local (sem componente de hora) — mesmo formato de <input type="date">. */
function dataLocalParaInput(data: Date): string {
  const ano = data.getFullYear()
  const mes = String(data.getMonth() + 1).padStart(2, "0")
  const dia = String(data.getDate()).padStart(2, "0")
  return `${ano}-${mes}-${dia}`
}

/** Preserva o filtro de status/data ao trocar um dos dois — omite o parâmetro quando está no padrão, pra manter a URL limpa em "hoje". */
function construirHref(status: FiltroStatusViagem, dataTexto?: string) {
  const params = new URLSearchParams()
  if (status !== "TODOS") params.set("status", status)
  if (dataTexto) params.set("data", dataTexto)
  const query = params.toString()
  return `/${query ? `?${query}` : ""}`
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParamsInput>
}) {
  const parametros = (await searchParams) ?? {}
  const filtroStatus = parseStatusFiltro(parametros.status)
  const dataSelecionada = parametros.data ? parseDataLocal(parametros.data) : new Date()
  const dataTextoInput = parametros.data ?? dataLocalParaInput(new Date())
  const vendoOutroDia = Boolean(parametros.data)

  const { filialId } = await requireSessaoPaginaComFilial()
  const [todosDoDia, quadroObservacoes] = await Promise.all([
    buscarDadosDashboard(filialId, dataSelecionada),
    buscarQuadroObservacoes(filialId),
  ])
  const { visiveis: itensOrdenados, contagem } = organizarViagensDoDashboard(
    todosDoDia.map((item) => ({ ...item, status: item.viagem.status, inicioPrevisto: item.viagem.inicioPrevisto })),
    filtroStatus,
  )
  const itens = itensOrdenados

  const explicacaoDashboard =
    "Painel de acompanhamento: viagens do dia selecionado em qualquer status, mais Retornando de dias anteriores e Finalizadas/Canceladas no dia. Aqui só se registra a saída real e o status — editar, alocar e criar é na Gestão de Viagens." +
    (vendoOutroDia ? " Status mostrado é o atual da viagem, não uma foto de como estava naquele dia — pra ver a mudança em si, use o Histórico." : "")

  // Indicadores e contagens saem da lista do dia inteiro, já carregada — sem
  // query extra, e os números não mudam ao filtrar.
  const contarStatus = (...status: StatusViagem[]) => status.reduce((soma, atual) => soma + (contagem[atual] ?? 0), 0)
  const semMotorista = todosDoDia.filter(
    (item) => item.viagem.motoristaId === null && !viagemEncerrada(item.viagem.status),
  ).length

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">Dashboard</h1>
            <span title={explicacaoDashboard} className="text-muted-foreground hover:text-foreground">
              <Info aria-hidden="true" className="size-4" />
              <span className="sr-only">{explicacaoDashboard}</span>
            </span>
          </div>
          <p className="text-muted-foreground mt-1">Viagens do dia selecionado, incluindo retornos pendentes.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href={construirHref("TODOS", parametros.data)}>
            <Button variant={filtroStatus === "TODOS" ? "default" : "outline"}>
              Todos<span className="tabular-nums opacity-70"> · {todosDoDia.length}</span>
            </Button>
          </Link>
          {STATUS_VIAGEM_OPCOES.map((status) => (
            <Link key={status.valor} href={construirHref(status.valor, parametros.data)}>
              <Button variant={filtroStatus === status.valor ? "default" : "outline"}>
                {status.label}
                <span className="tabular-nums opacity-70"> · {contarStatus(status.valor)}</span>
              </Button>
            </Link>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard rotulo="Viagens" valor={todosDoDia.length} icone={Route} />
        <StatCard
          rotulo="Sem motorista"
          valor={semMotorista}
          icone={UserX}
          classeValor={semMotorista > 0 ? "text-warning" : undefined}
        />
        <StatCard rotulo="Em andamento" valor={contarStatus("INICIADA", "RETORNANDO")} icone={PlayCircle} />
        <StatCard rotulo="Finalizadas" valor={contarStatus("FINALIZADA")} icone={CheckCircle2} />
      </div>

      <form method="get" className="flex flex-wrap items-center gap-2">
        {filtroStatus !== "TODOS" && <input type="hidden" name="status" value={filtroStatus} />}
        <Input type="date" name="data" defaultValue={dataTextoInput} className="w-40" />
        <Button type="submit" variant="outline" size="sm">
          <CalendarDays className="w-4 h-4 mr-2" />
          Ver dia
        </Button>
        {vendoOutroDia && (
          <Link href={construirHref(filtroStatus)}>
            <Button type="button" variant="ghost" size="sm">Voltar pra hoje</Button>
          </Link>
        )}
      </form>

      {itens.length === 0 ? (
        <EmptyState
          icone={Route}
          titulo="Nenhuma viagem"
          descricao="Nenhuma viagem encontrada para este filtro."
          acao={
            <Link href="/viagens/nova">
              <Button>
                <PlusCircle className="w-4 h-4 mr-2" />
                Nova viagem
              </Button>
            </Link>
          }
        />
      ) : (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-foreground">
              {vendoOutroDia
                ? dataTextoInput.split("-").reverse().join("/")
                : filtroStatus === "TODOS" ? "Hoje" : `Status: ${formatarStatusViagem(filtroStatus)}`}
            </h2>
            <div className="flex items-center gap-4">
              <LegendaMotoristas mostrarSituacao={false} />
              <Badge variant="outline">{itens.length}</Badge>
            </div>
          </div>
          <ViagensEmAndamentoTabela itens={itens} diaMostrado={dataTextoInput} />
          <ViagensEmAndamentoCards itens={itens} />
        </section>
      )}

      <QuadroDeObservacoes textoInicial={quadroObservacoes} />
    </div>
  )
}
