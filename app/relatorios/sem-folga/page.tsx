import Link from "next/link"
import { ArrowLeft, CalendarX, Download } from "lucide-react"
import { requireSessaoPaginaComFilial } from "@/lib/auth-guard"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { EmptyState } from "@/components/ui/empty-state"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { buscarFolgasEstouradas } from "@/lib/queries/sem-folga"
import { periodoSemFolga } from "@/lib/services/circadiano-periodo"
import { MAX_DIAS_SEM_FOLGA } from "@/lib/services/dias-sem-folga"
import { formatarCodigoFrota } from "@/lib/services/frota-regras"
import { formatarNomeProprio } from "@/lib/utils/texto"
import { formatarDataHoraPtBr, formatarHoraLocal } from "@/lib/utils/date-format"
import { classeBadgeTurno } from "@/app/viagens/badge-styles"

type SearchParamsInput = { de?: string; ate?: string }

export default async function SemFolgaPage({ searchParams }: { searchParams?: Promise<SearchParamsInput> }) {
  const parametros = (await searchParams) ?? {}
  const { filialId } = await requireSessaoPaginaComFilial()
  const periodo = periodoSemFolga(parametros.de, parametros.ate) ?? periodoSemFolga()!
  const registros = await buscarFolgasEstouradas(filialId, periodo.de, periodo.ate)

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <Link href="/relatorios" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-3" aria-hidden /> Relatórios
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Dias sem folga</h1>
        <p className="text-muted-foreground">
          Dias em que o relatório de jornada mostra o motorista trabalhando o {MAX_DIAS_SEM_FOLGA + 1}º dia seguido (ou mais) sem
          folga. Costuma acontecer quando ele bate o ponto antes da hora na volta do descanso.
        </p>
      </div>

      <form method="get" action="/relatorios/sem-folga" className="flex flex-wrap items-end gap-3 rounded-lg border bg-card p-3">
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
          <a href={`/api/relatorios/sem-folga?de=${periodo.deTexto}&ate=${periodo.ateTexto}`}>
            <Download className="size-4 mr-1.5" aria-hidden /> Baixar Excel
          </a>
        </Button>
      </form>

      {registros.length === 0 ? (
        <EmptyState
          icone={CalendarX}
          titulo="Ninguém passou de 6 dias sem folga"
          descricao="Vale a partir dos relatórios de jornada importados depois desta atualização."
        />
      ) : (
        <div className="rounded-lg border bg-card shadow-sm overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Dia</TableHead>
                <TableHead>Motorista</TableHead>
                <TableHead>Turno</TableHead>
                <TableHead>Dias sem folga</TableHead>
                <TableHead>Início</TableHead>
                <TableHead>Fim</TableHead>
                <TableHead>Atividade</TableHead>
                <TableHead>Nº Viagem</TableHead>
                <TableHead>Frota</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {registros.map((registro) => (
                <TableRow
                  key={`${registro.motoristaId}-${registro.dia.toISOString()}`}
                  className="bg-destructive/10 text-destructive hover:bg-destructive/15"
                >
                  <TableCell className="tabular-nums">{formatarDataHoraPtBr(registro.dia).slice(0, 5)}</TableCell>
                  <TableCell className="font-medium">{formatarNomeProprio(registro.motorista)}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={classeBadgeTurno(registro.turno)}>
                      {registro.turno === "NOITE" ? "Noite" : "Dia"}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-semibold tabular-nums">{registro.diasSemFolga}º dia</TableCell>
                  <TableCell className="font-mono tabular-nums">{registro.inicio ? formatarHoraLocal(registro.inicio) : "—"}</TableCell>
                  <TableCell className="font-mono tabular-nums">
                    {registro.fim ? `${formatarDataHoraPtBr(registro.fim).slice(0, 5)} ${formatarHoraLocal(registro.fim)}` : "—"}
                  </TableCell>
                  <TableCell>{registro.atividade === "VIAGEM" ? "Viagem" : "Interno"}</TableCell>
                  <TableCell className="font-mono">{registro.numViagem ?? "—"}</TableCell>
                  <TableCell className="font-mono tabular-nums">
                    {registro.cavalo ? `${formatarCodigoFrota(registro.cavalo)} / ${formatarCodigoFrota(registro.carreta ?? "")}` : "—"}
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
