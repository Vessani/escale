import Link from "next/link"
import { requireSessaoPaginaComFilial } from "@/lib/auth-guard"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"
import { Input } from "@/components/ui/input"
import { AlarmClock, CalendarDays, Download, Info, Moon, PlusCircle, Route, Sun } from "lucide-react"
import { Alert } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { buscarViagensDoDashboard } from "@/lib/queries/viagens"
import type { StatusViagem } from "@prisma/client"
import { NomeMotorista } from "@/components/motorista/icone-tipo-motorista"
import {
  STATUS_ALTERAVEIS_NO_DASHBOARD,
  STATUS_ATIVOS_DASHBOARD,
  STATUS_ENCERRADOS_DASHBOARD,
  organizarViagensDoDashboard,
  resumoPorTurno,
  viagemEncerrada,
} from "@/lib/services/dashboard.service"
import { cn } from "@/lib/utils"
import { serializeData } from "@/lib/serialization"
import { fimDoDia, formatDateForDateInput, formatarDataHoraPtBr, formatarHoraLocal, inicioDoDia, parseDataLocal } from "@/lib/utils/date-format"
import { RotaDestinos } from "@/components/viagem/rota-destinos"
import AtualizarSaidaReal from "./atualizar-saida-real"
import AtualizarStatusRapido from "./viagens/atualizar-status-rapido"
import QuadroDeObservacoes from "./quadro-de-observacoes"
import { buscarQuadroObservacoes } from "@/lib/queries/quadro"
import { formatarCodigoFrota } from "@/lib/services/frota-regras"
import { LegendaMotoristas } from "@/components/motorista/legenda-motoristas"
import { BotaoIcone } from "@/components/ui/botao-icone"
import { AtualizacaoAutomatica } from "@/components/atualizacao-automatica"
import { ModoTv } from "@/components/dashboard/modo-tv"
import { classePontoStatusViagem } from "@/app/viagens/badge-styles"
import { diaParaTexto } from "@/lib/relatorios/periodo"
import { TOLERANCIA_SAIDA_MINUTOS, minutosDeAtraso, saidaAtrasada } from "@/lib/services/pontualidade"

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
      {viagem.problemaMecanico && (
        <div title={viagem.problemaMecanico}>
          <Alert variant="error" inline>
            Problema mecânico
          </Alert>
          {/* Escrito, não só no balão: na TV ninguém passa o mouse. */}
          <p className="line-clamp-2 whitespace-normal break-words text-[11px] text-destructive">{viagem.problemaMecanico}</p>
        </div>
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

/** Excel de uma viagem (ordem de viagem) — pra mandar pro motorista. */
function BaixarOrdemDeViagem({ viagemId }: { viagemId: number }) {
  // prefetch desligado: é um download de arquivo, não uma página.
  return <BotaoIcone href={`/api/viagens/${viagemId}/excel`} prefetch={false} rotulo="Baixar ordem de viagem (Excel)" icone={Download} />
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
          <col className="fora-do-modo-tv w-11" />
        </colgroup>
        <TableHeader className="sticky top-0 z-10 bg-muted">
          <TableRow>
            <TableHead>Motorista(s)</TableHead>
            <TableHead>Viagem</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Início</TableHead>
            <TableHead>Saída real</TableHead>
            <TableHead>Destinos</TableHead>
            <TableHead className="fora-do-modo-tv"><span className="sr-only">Ordem de viagem</span></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {itens.map((item) => (
            <TableRow key={item.viagem.id}>
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
              <TableCell className="fora-do-modo-tv px-1">
                <BaixarOrdemDeViagem viagemId={item.viagem.id} />
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
          className="space-y-3 rounded-lg border bg-card shadow-sm p-4"
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
            <BaixarOrdemDeViagem viagemId={item.viagem.id} />
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
  data?: string
}

/** YYYY-MM-DD local (sem componente de hora) — mesmo formato de <input type="date">. */
function dataLocalParaInput(data: Date): string {
  // Dia em Brasília, não no fuso do servidor (na Vercel, UTC: depois das
  // 21h já seria "amanhã").
  return diaParaTexto(data)
}

/** "hoje · quinta-feira, 01/10" — no fuso de Brasília. */
function descreverDia(data: Date) {
  const texto = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", weekday: "long", day: "2-digit", month: "2-digit" }).format(data)
  const dia = texto.charAt(0).toUpperCase() + texto.slice(1)
  return diaParaTexto(data) === diaParaTexto(new Date()) ? `Hoje · ${texto}` : dia
}

const ROTULO_CONTADOR: Record<StatusViagem, string> = {
  CRIADA: "Criadas",
  ALOCADA: "Alocadas",
  INICIADA: "Iniciadas",
  RETORNANDO: "Retornando",
  POSTERGADA: "Postergadas",
  FINALIZADA: "Finalizadas",
  CANCELADA: "Canceladas",
}

const DICA_CONTADOR: Partial<Record<StatusViagem, string>> = {
  CRIADA: "Viagens ainda sem motorista.",
  RETORNANDO: "Inclui as que saíram em dias anteriores e ainda estão voltando.",
  FINALIZADA: "Finalizadas no dia — saem da lista, fica só o número.",
  CANCELADA: "Canceladas no dia — saem da lista, fica só o número.",
}

/** Contador de um status, com o ponto na cor do status (a mesma do seletor na lista). Encerradas ficam discretas. */
function ContadorStatus({ status, valor }: { status: StatusViagem; valor: number }) {
  const encerrado = viagemEncerrada(status)
  const alerta = status === "CRIADA" && valor > 0
  return (
    <div
      title={DICA_CONTADOR[status]}
      className={cn("rounded-lg border p-3 shadow-sm", encerrado ? "bg-muted/50 shadow-none" : "bg-card")}
    >
      <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <span aria-hidden className={cn("size-2 rounded-full", classePontoStatusViagem(status))} />
        {ROTULO_CONTADOR[status]}
      </p>
      <p
        className={cn(
          "mt-1 text-3xl font-semibold tabular-nums",
          encerrado && "text-muted-foreground",
          alerta && "text-warning",
          valor === 0 && !encerrado && "text-muted-foreground/50",
        )}
      >
        {valor}
      </p>
    </div>
  )
}

function plural(n: number, singular: string, pluralTexto: string) {
  return `${n} ${n === 1 ? singular : pluralTexto}`
}

/** Programação do dia por turno: "Dia: 4 viagens · 7 entregas". */
function ResumoTurnos({ resumo }: { resumo: ReturnType<typeof resumoPorTurno> }) {
  const linhas = [
    { rotulo: "Dia", icone: Sun, ...resumo.dia },
    { rotulo: "Noite", icone: Moon, ...resumo.noite },
  ]
  return (
    <div
      className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm"
      title="Viagens que começam no dia (sem as canceladas) e as entregas delas. Dia: início até 15:59; Noite: a partir das 16:00."
    >
      {linhas.map(({ rotulo, icone: Icone, viagens, entregas }) => (
        <span key={rotulo} className="flex items-center gap-1.5 text-muted-foreground">
          <Icone aria-hidden className="size-4" />
          <span className="font-medium text-foreground">{rotulo}:</span>
          <span className="tabular-nums">
            {plural(viagens, "viagem", "viagens")} · {plural(entregas, "entrega", "entregas")}
          </span>
        </span>
      ))}
      <span className="flex items-center gap-1.5 rounded-md bg-muted px-2 py-0.5">
        <span className="font-medium text-foreground">Total:</span>
        <span className="tabular-nums text-foreground">
          {plural(resumo.total.viagens, "viagem", "viagens")} · {plural(resumo.total.entregas, "entrega", "entregas")}
        </span>
      </span>
    </div>
  )
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParamsInput>
}) {
  const parametros = (await searchParams) ?? {}
  const dataSelecionada = parametros.data ? parseDataLocal(parametros.data) : new Date()
  const dataTextoInput = parametros.data ?? dataLocalParaInput(new Date())
  const vendoOutroDia = Boolean(parametros.data)

  const { filialId } = await requireSessaoPaginaComFilial()
  const [todosDoDia, quadroObservacoes] = await Promise.all([
    buscarDadosDashboard(filialId, dataSelecionada),
    buscarQuadroObservacoes(filialId),
  ])
  const { ativas: itens, contagem } = organizarViagensDoDashboard(
    todosDoDia.map((item) => ({ ...item, status: item.viagem.status, inicioPrevisto: item.viagem.inicioPrevisto })),
  )
  const resumo = resumoPorTurno(
    todosDoDia.map((item) => item.viagem),
    inicioDoDia(dataSelecionada),
    fimDoDia(dataSelecionada),
  )

  const explicacaoDashboard =
    "Painel de acompanhamento: na lista, só o que ainda está ativo (criadas, alocadas, iniciadas, retornando — inclusive de dias anteriores — e postergadas). Finalizadas e canceladas no dia ficam só no contador. Aqui só se registra a saída real e o status — editar, alocar e criar é na Gestão de Viagens." +
    (vendoOutroDia ? " Status mostrado é o atual da viagem, não uma foto de como estava naquele dia — pra ver a mudança em si, use o Histórico." : "")

  const saidas = todosDoDia.filter((item) => item.viagem.horarioRealSaida)
  const saidasAtrasadas = saidas.filter((item) =>
    saidaAtrasada(minutosDeAtraso(item.viagem.inicioPrevisto, item.viagem.horarioRealSaida!)),
  ).length
  const dataTexto = dataLocalParaInput(dataSelecionada)
  const atualizadoEm = formatarHoraLocal(new Date())

  return (
    <div id="painel-dashboard" className="space-y-5">
      {/* O que o motorista registra no celular (saída, encerramento) aparece sozinho. */}
      <AtualizacaoAutomatica segundos={60} />
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">Dashboard</h1>
            <span title={explicacaoDashboard} className="fora-do-modo-tv text-muted-foreground hover:text-foreground">
              <Info aria-hidden="true" className="size-4" />
              <span className="sr-only">{explicacaoDashboard}</span>
            </span>
          </div>
          <p className="mt-1 text-muted-foreground">
            <span>{descreverDia(dataSelecionada)}</span>
            <span className="tabular-nums"> · atualizado às {atualizadoEm}</span>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <form method="get" className="fora-do-modo-tv flex items-center gap-2">
            <Input type="date" name="data" defaultValue={dataTextoInput} className="w-40" aria-label="Dia" />
            <Button type="submit" variant="outline" size="sm">
              <CalendarDays className="mr-2 size-4" aria-hidden />
              Ver dia
            </Button>
            {vendoOutroDia && (
              <Link href="/">
                <Button type="button" variant="ghost" size="sm">Voltar pra hoje</Button>
              </Link>
            )}
          </form>
          <Button asChild variant="outline" size="sm" className="fora-do-modo-tv">
            <a href={`/api/relatorios/programacao?data=${dataTexto}`} title="Excel com todas as viagens do dia: horários, motorista, acompanhante, frota e entregas.">
              <Download className="mr-2 size-4" aria-hidden />
              Programação do dia
            </a>
          </Button>
          <ModoTv alvoId="painel-dashboard" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-8">
        {STATUS_ATIVOS_DASHBOARD.map((status) => (
          <ContadorStatus key={status} status={status} valor={contagem[status] ?? 0} />
        ))}
        {STATUS_ENCERRADOS_DASHBOARD.map((status) => (
          <ContadorStatus key={status} status={status} valor={contagem[status] ?? 0} />
        ))}
        <Link
          href={`/relatorios/pontualidade?de=${dataTexto}&ate=${dataTexto}`}
          title={`Saídas registradas até ${TOLERANCIA_SAIDA_MINUTOS} min depois do previsto contam como no horário. Clique pra ver o relatório.`}
          className="rounded-lg border bg-card p-3 shadow-sm transition-opacity hover:opacity-90"
        >
          <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <AlarmClock aria-hidden className="size-3.5" />
            No horário
          </p>
          <p className="mt-1 flex flex-wrap items-baseline gap-x-1.5">
            <span className={cn("text-3xl font-semibold tabular-nums", saidasAtrasadas > 0 && "text-warning")}>
              {saidas.length ? `${Math.round(((saidas.length - saidasAtrasadas) / saidas.length) * 100)}%` : "—"}
            </span>
            {saidas.length > 0 && (
              <span className="whitespace-nowrap text-xs tabular-nums text-muted-foreground">
                {saidas.length - saidasAtrasadas} de {saidas.length}
              </span>
            )}
          </p>
        </Link>
      </div>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <h2 className="text-xl font-semibold text-foreground">
            Em aberto <span className="tabular-nums text-muted-foreground">· {itens.length}</span>
          </h2>
          <ResumoTurnos resumo={resumo} />
        </div>
        {itens.length === 0 ? (
          <EmptyState
            icone={Route}
            titulo="Nenhuma viagem em aberto"
            descricao="As viagens do dia já foram finalizadas ou canceladas — ou ainda não foram criadas."
            acao={
              <Link href="/viagens/nova" className="fora-do-modo-tv">
                <Button>
                  <PlusCircle className="mr-2 size-4" />
                  Nova viagem
                </Button>
              </Link>
            }
          />
        ) : (
          <>
            <ViagensEmAndamentoTabela itens={itens} diaMostrado={dataTextoInput} />
            <ViagensEmAndamentoCards itens={itens} />
            <div className="flex justify-end">
              <LegendaMotoristas mostrarSituacao={false} />
            </div>
          </>
        )}
      </section>

      {/* Na TV, o quadro só aparece se tiver recado. */}
      <div className={cn(!quadroObservacoes.trim() && "fora-do-modo-tv")}>
        <QuadroDeObservacoes textoInicial={quadroObservacoes} />
      </div>
    </div>
  )
}
