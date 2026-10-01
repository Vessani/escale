import Link from "next/link"
import { ArrowLeft, Download, MoonStar } from "lucide-react"
import { requireSessaoPaginaComFilial } from "@/lib/auth-guard"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { EmptyState } from "@/components/ui/empty-state"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { buscarRelatorioCircadiano } from "@/lib/queries/circadiano"
import { periodoCircadiano } from "@/lib/services/circadiano-periodo"
import { formatarExcedente, type OcorrenciaCircadiano } from "@/lib/services/circadiano.service"
import { formatarCodigoFrota } from "@/lib/services/frota-regras"
import { formatarNomeProprio } from "@/lib/utils/texto"
import { formatarDataHoraPtBr, formatarHoraLocal } from "@/lib/utils/date-format"
import { classeBadgeTurno } from "@/app/viagens/badge-styles"

type SearchParamsInput = { de?: string; ate?: string }

/** "29/09 18:40" — com a data só quando a jornada vira o dia. */
function horario(instante: Date, dia: Date) {
  const mesmoDia = formatarDataHoraPtBr(instante).slice(0, 10) === formatarDataHoraPtBr(dia).slice(0, 10)
  return mesmoDia ? formatarHoraLocal(instante) : `${formatarDataHoraPtBr(instante).slice(0, 5)} ${formatarHoraLocal(instante)}`
}

function TabelaOcorrencias({ ocorrencias }: { ocorrencias: OcorrenciaCircadiano[] }) {
  return (
    <div className="rounded-lg border bg-card shadow-sm overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Dia</TableHead>
            <TableHead>Motorista</TableHead>
            <TableHead>Turno</TableHead>
            <TableHead>Início</TableHead>
            <TableHead>Fim</TableHead>
            <TableHead>Passou do limite</TableHead>
            <TableHead>Atividade</TableHead>
            <TableHead>Nº Viagem</TableHead>
            <TableHead>Frota</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {ocorrencias.map((ocorrencia) => (
            <TableRow key={`${ocorrencia.tipo}-${ocorrencia.motoristaId}-${ocorrencia.inicio.toISOString()}`}>
              <TableCell className="tabular-nums">{formatarDataHoraPtBr(ocorrencia.dia).slice(0, 5)}</TableCell>
              <TableCell className="font-medium">{formatarNomeProprio(ocorrencia.motorista)}</TableCell>
              <TableCell>
                <Badge variant="outline" className={classeBadgeTurno(ocorrencia.turno)}>
                  {ocorrencia.turno === "NOITE" ? "Noite" : "Dia"}
                </Badge>
              </TableCell>
              <TableCell className="font-mono tabular-nums">{horario(ocorrencia.inicio, ocorrencia.dia)}</TableCell>
              <TableCell className="font-mono tabular-nums font-medium text-destructive">
                {horario(ocorrencia.fim, ocorrencia.dia)}
              </TableCell>
              <TableCell className="tabular-nums" title={`Limite do turno: ${formatarDataHoraPtBr(ocorrencia.limite)}`}>
                +{formatarExcedente(ocorrencia.minutosExcedidos)}
                <span className="text-muted-foreground"> (após {formatarHoraLocal(ocorrencia.limite)})</span>
              </TableCell>
              <TableCell>
                {ocorrencia.atividade === "VIAGEM" ? (
                  <Badge variant="outline">Viagem</Badge>
                ) : (
                  <Badge variant="outline" className="text-muted-foreground">Interno</Badge>
                )}
              </TableCell>
              <TableCell className="font-mono">{ocorrencia.numViagem ?? "—"}</TableCell>
              <TableCell className="font-mono tabular-nums">
                {ocorrencia.cavalo ? `${formatarCodigoFrota(ocorrencia.cavalo)} / ${formatarCodigoFrota(ocorrencia.carreta ?? "")}` : "—"}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

export default async function CircadianoPage({ searchParams }: { searchParams?: Promise<SearchParamsInput> }) {
  const parametros = (await searchParams) ?? {}
  const { filialId } = await requireSessaoPaginaComFilial()
  const periodo = periodoCircadiano(parametros.de, parametros.ate) ?? periodoCircadiano()!
  const relatorio = await buscarRelatorioCircadiano(filialId, periodo.de, periodo.ate)
  const query = `de=${periodo.deTexto}&ate=${periodo.ateTexto}`

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <Link href="/relatorios" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-3" aria-hidden /> Relatórios
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Ciclo circadiano</h1>
        <p className="text-muted-foreground">
          Motoristas do turno do dia que passam das <strong>22:00</strong> e do turno da noite que passam das{" "}
          <strong>05:00</strong>. Só entra quem aparece no relatório de jornada.
        </p>
      </div>

      <form method="get" action="/relatorios/circadiano" className="flex flex-wrap items-end gap-3 rounded-lg border bg-card p-3">
        <label className="grid gap-1 text-xs text-muted-foreground">
          De
          <Input type="date" name="de" defaultValue={periodo.deTexto} className="h-8 w-40 text-xs" />
        </label>
        <label className="grid gap-1 text-xs text-muted-foreground">
          Até
          <Input type="date" name="ate" defaultValue={periodo.ateTexto} className="h-8 w-40 text-xs" />
        </label>
        <Button type="submit" size="sm" variant="outline">Filtrar</Button>
        <Button asChild size="sm" className="ml-auto">
          <a href={`/api/relatorios/circadiano?${query}`}>
            <Download className="size-4 mr-1.5" aria-hidden /> Baixar Excel
          </a>
        </Button>
      </form>

      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold">Previsto — viagens agendadas</h2>
          <p className="text-sm text-muted-foreground">
            Jornada estimada em até 12h a partir do início da viagem (ou até o fim previsto, se terminar antes).
            {relatorio.relatorioAte
              ? ` Só viagens depois de ${formatarDataHoraPtBr(relatorio.relatorioAte).slice(0, 10)}, último dia do relatório importado.`
              : ""}
          </p>
        </div>
        {relatorio.previstas.length === 0 ? (
          <EmptyState icone={MoonStar} titulo="Nenhuma viagem agendada passa do horário" descricao="Nenhum motorista do relatório vai passar do limite do turno nas viagens desse período." />
        ) : (
          <TabelaOcorrencias ocorrencias={relatorio.previstas} />
        )}
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold">Realizado — relatório de jornada</h2>
          <p className="text-sm text-muted-foreground">
            Início e fim reais do relatório importado, com a viagem do Escale que o motorista fazia no horário (sem viagem = Interno).
          </p>
        </div>
        {relatorio.realizadas.length === 0 ? (
          <EmptyState icone={MoonStar} titulo="Ninguém passou do horário" descricao="Nenhuma jornada do relatório nesse período terminou depois do limite do turno." />
        ) : (
          <TabelaOcorrencias ocorrencias={relatorio.realizadas} />
        )}
      </section>
    </div>
  )
}
