import { Gauge } from "lucide-react"
import { requireSessaoPaginaComFilial } from "@/lib/auth-guard"
import { PAPEIS_LEITURA } from "@/lib/papeis"
import { Badge } from "@/components/ui/badge"
import { EmptyState } from "@/components/ui/empty-state"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  BadgeAtividade,
  BadgeTurno,
  CabecalhoRelatorio,
  FiltroRelatorio,
  MolduraTabela,
  textoFrota,
} from "@/components/relatorio/pagina-relatorio"
import { AutorizacaoEstouroCelula } from "@/components/relatorio/autorizacao-estouro"
import { carregarCiclos72h } from "@/lib/queries/relatorios/estouros"
import { OPCOES_HORAS_ALERTA_CICLO, PERIODO_PADRAO, parseHorasAlertaCiclo } from "@/lib/relatorios/catalogo"
import { periodoOuPadrao } from "@/lib/relatorios/periodo"
import { formatarDiaCompleto, formatarDiaCurto, formatarDuracao, formatarHorarioRelativo } from "@/lib/relatorios/formato"
import { HORAS_LIMITE_CICLO } from "@/lib/services/relatorios/jornada-analise"
import { MINIMO_HORAS_ENTRE_FOLGAS } from "@/lib/services/alocacao/disponibilidade"
import { formatarNomeProprio } from "@/lib/utils/texto"
import { cn } from "@/lib/utils"

export const metadata = { title: "Estouro de 72h" }

type SearchParamsInput = { de?: string; ate?: string; horas?: string }

const LIMITE_MINUTOS = HORAS_LIMITE_CICLO * 60

export default async function Estouro72hPage({ searchParams }: { searchParams?: Promise<SearchParamsInput> }) {
  const parametros = (await searchParams) ?? {}
  const { filialId } = await requireSessaoPaginaComFilial(PAPEIS_LEITURA)
  const periodo = periodoOuPadrao(parametros.de, parametros.ate, PERIODO_PADRAO.ciclo72h)
  const alerta = parseHorasAlertaCiclo(parametros.horas)
  const { ciclos, coberturaAte } = await carregarCiclos72h(filialId, periodo, alerta)
  const estourados = ciclos.filter((c) => c.excedenteMinutos > 0).length
  const emAndamento = ciclos.filter((c) => !c.encerrado).length

  return (
    <div className="space-y-6">
      <CabecalhoRelatorio titulo="Estouro de 72h">
        Horas trabalhadas (soma das jornadas do relatório de jornada) desde a última folga de {MINIMO_HORAS_ENTRE_FOLGAS}h. O teto é{" "}
        <strong>{HORAS_LIMITE_CICLO}h</strong> antes da próxima folga; aqui aparece quem passou de <strong>{alerta}h</strong>.
        {coberturaAte && <> Relatório de jornada importado até {formatarDiaCompleto(coberturaAte)}.</>}
        {ciclos.length > 0 && (
          <>
            {" "}
            <strong className={estourados > 0 ? "text-destructive" : undefined}>{estourados}</strong> passaram de {HORAS_LIMITE_CICLO}h ·{" "}
            <strong>{emAndamento}</strong> ainda sem a folga de {MINIMO_HORAS_ENTRE_FOLGAS}h.
          </>
        )}
      </CabecalhoRelatorio>

      <FiltroRelatorio
        action="/relatorios/estouro-72h"
        periodo={periodo}
        exportarTipo="estouro-72h"
        exportarQuery={{ de: periodo.deTexto, ate: periodo.ateTexto, horas: alerta }}
      >
        <label className="grid gap-1 text-xs text-muted-foreground">
          A partir de
          <select
            name="horas"
            defaultValue={alerta}
            className="h-8 w-28 rounded-md border border-input bg-background px-2 text-xs text-foreground"
          >
            {OPCOES_HORAS_ALERTA_CICLO.map((horas) => (
              <option key={horas} value={horas}>
                {horas} horas
              </option>
            ))}
          </select>
        </label>
      </FiltroRelatorio>

      {ciclos.length === 0 ? (
        <EmptyState
          icone={Gauge}
          titulo={`Ninguém passou de ${alerta}h no ciclo`}
          descricao={`Nenhum motorista somou ${alerta}h de jornada entre folgas de ${MINIMO_HORAS_ENTRE_FOLGAS}h nesse período.`}
        />
      ) : (
        <MolduraTabela>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Motorista</TableHead>
                <TableHead>Turno</TableHead>
                <TableHead>Ciclo</TableHead>
                <TableHead>Jornadas</TableHead>
                <TableHead>Horas no ciclo</TableHead>
                <TableHead>72h</TableHead>
                <TableHead>Folga de {MINIMO_HORAS_ENTRE_FOLGAS}h</TableHead>
                <TableHead>Estouros autorizados</TableHead>
                <TableHead>Última atividade</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ciclos.map((c) => {
                const passou = c.excedenteMinutos > 0
                const proporcao = Math.min(1, c.horasMinutos / LIMITE_MINUTOS)
                return (
                  <TableRow key={`${c.motoristaId}-${c.inicio.toISOString()}`}>
                    <TableCell className="font-medium">{formatarNomeProprio(c.motorista)}</TableCell>
                    <TableCell>
                      <BadgeTurno turno={c.turno} />
                    </TableCell>
                    <TableCell className="whitespace-nowrap font-mono text-xs tabular-nums">
                      {formatarDiaCurto(c.inicio)} {formatarHorarioRelativo(c.inicio, c.inicio)}
                      <span className="block text-muted-foreground">→ {formatarHorarioRelativo(c.fim, c.inicio)}</span>
                    </TableCell>
                    <TableCell className="tabular-nums">{c.jornadas}</TableCell>
                    <TableCell className="min-w-36">
                      <span className={cn("font-semibold tabular-nums", passou ? "text-destructive" : "text-warning")}>
                        {formatarDuracao(c.horasMinutos)}
                      </span>
                      <div
                        className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted"
                        role="img"
                        aria-label={`${Math.round(proporcao * 100)}% das ${HORAS_LIMITE_CICLO}h`}
                      >
                        <div
                          className={cn("h-full rounded-full", passou ? "bg-destructive" : "bg-warning")}
                          style={{ width: `${proporcao * 100}%` }}
                        />
                      </div>
                    </TableCell>
                    <TableCell className="whitespace-nowrap tabular-nums">
                      {passou ? (
                        <>
                          <span className="font-medium text-destructive">+{formatarDuracao(c.excedenteMinutos)}</span>
                          {c.passouEm && (
                            <span className="block text-xs text-muted-foreground">
                              desde {formatarHorarioRelativo(c.passouEm, c.inicio)}
                            </span>
                          )}
                        </>
                      ) : (
                        <span className="text-muted-foreground">faltam {formatarDuracao(c.faltamMinutos)}</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {c.encerrado ? (
                        <Badge variant="outline" className="border-border bg-muted text-muted-foreground">
                          Folgou
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="border-warning/30 bg-warning/10 text-warning">
                          Ainda não folgou
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {/* Abaixo das 72h e sem pedido: não havia o que autorizar. */}
                      {passou || c.autorizacoes.length > 0 ? (
                        <AutorizacaoEstouroCelula autorizacoes={c.autorizacoes} />
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      <BadgeAtividade atividade={c.atividade} />
                      <span className="mt-1 block font-mono text-xs text-muted-foreground">
                        {c.numViagem ?? textoFrota(c.cavalo, c.carreta)}
                      </span>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </MolduraTabela>
      )}
    </div>
  )
}
