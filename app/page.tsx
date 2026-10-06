import Link from "next/link"
import { requireSessaoPaginaComFilial } from "@/lib/auth-guard"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"
import { Input } from "@/components/ui/input"
import { AlarmClock, CalendarDays, Download, Info, PlusCircle, Route } from "lucide-react"
import { STATUS_ATIVOS_DASHBOARD, STATUS_ENCERRADOS_DASHBOARD, organizarViagensDoDashboard, resumoPorTurno } from "@/lib/services/dashboard.service"
import { cn } from "@/lib/utils"
import { fimDoDia, formatarHoraLocal, inicioDoDia, parseDataLocal } from "@/lib/utils/date-format"
import QuadroDeObservacoes, { ID_SLOT_QUADRO } from "./quadro-de-observacoes"
import { buscarQuadroObservacoes } from "@/lib/queries/quadro"
import { LegendaMotoristas } from "@/components/motorista/legenda-motoristas"
import { AtualizacaoAutomatica } from "@/components/atualizacao-automatica"
import { ModoTv } from "@/components/dashboard/modo-tv"
import { diaParaTexto } from "@/lib/relatorios/periodo"
import { TOLERANCIA_SAIDA_MINUTOS, minutosDeAtraso, saidaAtrasada } from "@/lib/services/pontualidade"
import { buscarItensDoDashboard } from "@/lib/queries/dashboard"
import { ViagensEmAndamentoCards, ViagensEmAndamentoTabela } from "@/components/dashboard/viagens-em-andamento"
import { ContadorStatus, ResumoTurnos } from "@/components/dashboard/resumo-do-dia"

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
    buscarItensDoDashboard(filialId, dataSelecionada),
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
    "Painel de acompanhamento: na lista, só o que ainda está ativo (criadas, alocadas, iniciadas, retornando e postergadas). De dias anteriores aparecem as que saíram e não encerraram (“desde 01/10”) e as que não saíram quando deviam (“não saiu”, até 30 dias). Finalizadas e canceladas no dia ficam só no contador. Aqui só se registra a saída real e o status — editar, alocar e criar é na Gestão de Viagens." +
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
      {/* Modo TV: só os dados das viagens — some título, recado, contadores e legenda. */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="fora-do-modo-tv">
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
          {/* A chave muda quando o recado muda no servidor (outro computador
              editou): a atualização automática traz o texto novo — sem ela o
              componente guardava o recado de quando a tela abriu. */}
          <QuadroDeObservacoes key={quadroObservacoes} textoInicial={quadroObservacoes} />
          <ModoTv alvoId="painel-dashboard" />
        </div>
      </div>

      {/* Recado do quadro de observações (ou o editor), quando houver. */}
      <div id={ID_SLOT_QUADRO} className="fora-do-modo-tv empty:hidden" />

      <div className="fora-do-modo-tv grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-8">
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
            <div className="fora-do-modo-tv flex justify-end">
              <LegendaMotoristas mostrarSituacao={false} />
            </div>
          </>
        )}
      </section>

    </div>
  )
}
