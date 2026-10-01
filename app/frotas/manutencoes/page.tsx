import Link from "next/link"
import { ArrowLeft, PlusCircle, Wrench } from "lucide-react"
import { requireSessaoPaginaComFilial } from "@/lib/auth-guard"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { buscarManutencoes, buscarVeiculosCadastrados } from "@/lib/queries/manutencoes"
import {
  ROTULO_RESPONSAVEL,
  ROTULO_SITUACAO,
  ROTULO_VEICULO,
  descreverTipo,
  fimEfetivo,
  inicioEfetivo,
  situacaoManutencao,
  type SituacaoManutencao,
} from "@/lib/services/manutencao-regras"
import { formatDateTimeForInput, formatarDataHoraPtBr } from "@/lib/utils/date-format"
import { formatarDuracao } from "@/lib/relatorios/formato"
import { cn } from "@/lib/utils"
import AcoesManutencao from "./acoes-manutencao"

type Manutencao = Awaited<ReturnType<typeof buscarManutencoes>>[number]

const CLASSE_SITUACAO: Record<SituacaoManutencao, string> = {
  AGENDADA: "border-info/30 bg-info/10 text-info",
  EM_ANDAMENTO: "border-warning/30 bg-warning/10 text-warning",
  ATRASADA: "border-destructive/30 bg-destructive/10 text-destructive",
  CONCLUIDA: "border-success/30 bg-success/10 text-success",
}

function Periodo({ manutencao, agora }: { manutencao: Manutencao; agora: Date }) {
  const situacao = situacaoManutencao(manutencao, agora)
  const previsto = `${formatarDataHoraPtBr(manutencao.inicioPrevisto)} → ${manutencao.fimPrevisto ? formatarDataHoraPtBr(manutencao.fimPrevisto) : "sem previsão"}`
  if (situacao === "AGENDADA") return <span className="tabular-nums">{previsto}</span>

  const inicio = inicioEfetivo(manutencao)
  const fim = manutencao.fimReal ?? agora
  return (
    <div className="space-y-0.5 tabular-nums">
      <div>
        {formatarDataHoraPtBr(inicio)} → {manutencao.fimReal ? formatarDataHoraPtBr(manutencao.fimReal) : "em aberto"}
        <span className="ml-1.5 text-xs text-muted-foreground">({formatarDuracao((fim.getTime() - inicio.getTime()) / 60_000)})</span>
      </div>
      <div className="text-xs text-muted-foreground">Previsto: {previsto}</div>
    </div>
  )
}

function TabelaManutencoes({
  manutencoes,
  agora,
  conjuntoDe,
}: {
  manutencoes: Manutencao[]
  agora: Date
  conjuntoDe: (manutencao: Manutencao) => string | null
}) {
  return (
    <div className="rounded-lg border bg-card shadow-sm overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Veículo</TableHead>
            <TableHead>Manutenção</TableHead>
            <TableHead>Responsável</TableHead>
            <TableHead>Período</TableHead>
            <TableHead>Situação</TableHead>
            <TableHead className="w-36"><span className="sr-only">Ações</span></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {manutencoes.map((manutencao) => {
            const situacao = situacaoManutencao(manutencao, agora)
            const conjunto = conjuntoDe(manutencao)
            const fimPrevistoPassou = manutencao.fimPrevisto && manutencao.fimPrevisto < agora
            return (
              <TableRow key={manutencao.id} className={cn(situacao === "CONCLUIDA" && "text-muted-foreground")}>
                <TableCell>
                  <div className="font-mono font-medium">{ROTULO_VEICULO[manutencao.veiculo]} {manutencao.codigo}</div>
                  {conjunto && <div className="text-xs text-muted-foreground">Conjunto {conjunto}</div>}
                </TableCell>
                <TableCell className="max-w-72">
                  <div className="font-medium">{descreverTipo(manutencao)}</div>
                  {manutencao.descricao && (
                    <div className="truncate text-xs text-muted-foreground" title={manutencao.descricao}>{manutencao.descricao}</div>
                  )}
                </TableCell>
                <TableCell>{ROTULO_RESPONSAVEL[manutencao.responsavel]}</TableCell>
                <TableCell className="text-sm"><Periodo manutencao={manutencao} agora={agora} /></TableCell>
                <TableCell>
                  <Badge variant="outline" className={CLASSE_SITUACAO[situacao]}>{ROTULO_SITUACAO[situacao]}</Badge>
                </TableCell>
                <TableCell>
                  <AcoesManutencao
                    id={manutencao.id}
                    situacao={situacao}
                    descricaoCurta={`${descreverTipo(manutencao)} · ${ROTULO_VEICULO[manutencao.veiculo]} ${manutencao.codigo}`}
                    sugestaoFim={fimPrevistoPassou ? formatDateTimeForInput(manutencao.fimPrevisto!) : null}
                  />
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}

export default async function ManutencoesPage() {
  const { filialId } = await requireSessaoPaginaComFilial()
  const [manutencoes, conjuntos] = await Promise.all([buscarManutencoes(filialId), buscarVeiculosCadastrados(filialId)])
  const agora = new Date()

  const conjuntoDe = (manutencao: Manutencao) => {
    const conjunto = conjuntos.find((c) => (manutencao.veiculo === "CAVALO" ? c.cavalo : c.carreta) === manutencao.codigo)
    return conjunto ? `${conjunto.cavalo} / ${conjunto.carreta}` : null
  }
  const porSituacao = (...situacoes: SituacaoManutencao[]) =>
    manutencoes.filter((m) => situacoes.includes(situacaoManutencao(m, agora)))
  const emAndamento = porSituacao("ATRASADA", "EM_ANDAMENTO")
  const agendadas = porSituacao("AGENDADA")
  const concluidas = porSituacao("CONCLUIDA").sort(
    (a, b) => (fimEfetivo(b, agora)?.getTime() ?? 0) - (fimEfetivo(a, agora)?.getTime() ?? 0),
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-1">
          <Link href="/frotas" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
            <ArrowLeft className="size-3" aria-hidden /> Frotas
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Manutenções</h1>
          <p className="text-muted-foreground">
            Agenda de manutenção dos cavalos e carretas. O veículo fica indisponível do início até a conclusão — se passar
            da previsão sem concluir, continua parado e aparece em vermelho.
          </p>
        </div>
        <Link href="/frotas/manutencoes/nova">
          <Button>
            <PlusCircle className="w-5 h-5 mr-2" />
            Agendar manutenção
          </Button>
        </Link>
      </div>

      {manutencoes.length === 0 ? (
        <EmptyState
          icone={Wrench}
          titulo="Nenhuma manutenção"
          descricao="Agende a próxima manutenção de um cavalo ou carreta — ela já passa a contar na disponibilidade e nos avisos das viagens."
        />
      ) : (
        <>
          {emAndamento.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-lg font-semibold">Parados agora <span className="text-muted-foreground font-normal">· {emAndamento.length}</span></h2>
              <TabelaManutencoes manutencoes={emAndamento} agora={agora} conjuntoDe={conjuntoDe} />
            </section>
          )}
          <section className="space-y-3">
            <h2 className="text-lg font-semibold">Agendadas <span className="text-muted-foreground font-normal">· {agendadas.length}</span></h2>
            {agendadas.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma manutenção agendada.</p>
            ) : (
              <TabelaManutencoes manutencoes={agendadas} agora={agora} conjuntoDe={conjuntoDe} />
            )}
          </section>
          {concluidas.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-lg font-semibold">Concluídas nos últimos 30 dias <span className="text-muted-foreground font-normal">· {concluidas.length}</span></h2>
              <TabelaManutencoes manutencoes={concluidas} agora={agora} conjuntoDe={conjuntoDe} />
            </section>
          )}
        </>
      )}
    </div>
  )
}
