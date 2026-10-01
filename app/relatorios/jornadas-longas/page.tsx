import { Timer } from "lucide-react"
import { requireSessaoPaginaComFilial } from "@/lib/auth-guard"
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
import { carregarDadosJornada } from "@/lib/queries/relatorios/jornada"
import { OPCOES_HORAS_JORNADA_LONGA, PERIODO_PADRAO, parseHorasJornadaLonga } from "@/lib/relatorios/catalogo"
import { periodoOuPadrao } from "@/lib/relatorios/periodo"
import { formatarDiaCurto, formatarDuracao, formatarHorarioRelativo } from "@/lib/relatorios/formato"
import { jornadasLongas } from "@/lib/services/relatorios/jornada-analise"
import { formatarNomeProprio } from "@/lib/utils/texto"

type SearchParamsInput = { de?: string; ate?: string; horas?: string }

export default async function JornadasLongasPage({ searchParams }: { searchParams?: Promise<SearchParamsInput> }) {
  const parametros = (await searchParams) ?? {}
  const { filialId } = await requireSessaoPaginaComFilial()
  const periodo = periodoOuPadrao(parametros.de, parametros.ate, PERIODO_PADRAO.jornadasLongas)
  const limite = parseHorasJornadaLonga(parametros.horas)
  const dados = await carregarDadosJornada(filialId, periodo.de, periodo.ate)
  const ocorrencias = jornadasLongas(dados.motoristas, dados.jornadas, dados.viagens, periodo.de, periodo.ate, limite)

  return (
    <div className="space-y-6">
      <CabecalhoRelatorio titulo="Jornadas longas">
        Jornadas reais (relatório de jornada) que passaram de <strong>{limite}h</strong> do início ao fim.
      </CabecalhoRelatorio>

      <FiltroRelatorio
        action="/relatorios/jornadas-longas"
        periodo={periodo}
        exportarTipo="jornadas-longas"
        exportarQuery={{ de: periodo.deTexto, ate: periodo.ateTexto, horas: limite }}
      >
        <label className="grid gap-1 text-xs text-muted-foreground">
          Acima de
          <select
            name="horas"
            defaultValue={limite}
            className="h-8 w-28 rounded-md border border-input bg-background px-2 text-xs text-foreground"
          >
            {OPCOES_HORAS_JORNADA_LONGA.map((horas) => (
              <option key={horas} value={horas}>{horas} horas</option>
            ))}
          </select>
        </label>
      </FiltroRelatorio>

      {ocorrencias.length === 0 ? (
        <EmptyState icone={Timer} titulo={`Nenhuma jornada passou de ${limite}h`} descricao="Nenhuma jornada do relatório nesse período passou do limite escolhido." />
      ) : (
        <MolduraTabela>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Dia</TableHead>
                <TableHead>Motorista</TableHead>
                <TableHead>Turno</TableHead>
                <TableHead>Início</TableHead>
                <TableHead>Fim</TableHead>
                <TableHead>Duração</TableHead>
                <TableHead>Passou</TableHead>
                <TableHead>Atividade</TableHead>
                <TableHead>Nº Viagem</TableHead>
                <TableHead>Frota</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ocorrencias.map((item) => (
                <TableRow key={`${item.motoristaId}-${item.inicio.toISOString()}`}>
                  <TableCell className="tabular-nums">{formatarDiaCurto(item.inicio)}</TableCell>
                  <TableCell className="font-medium">{formatarNomeProprio(item.motorista)}</TableCell>
                  <TableCell><BadgeTurno turno={item.turno} /></TableCell>
                  <TableCell className="font-mono tabular-nums">{formatarHorarioRelativo(item.inicio, item.inicio)}</TableCell>
                  <TableCell className="font-mono tabular-nums">{formatarHorarioRelativo(item.fim, item.inicio)}</TableCell>
                  <TableCell className="tabular-nums font-medium">{formatarDuracao(item.duracaoMinutos)}</TableCell>
                  <TableCell className="tabular-nums text-destructive">+{formatarDuracao(item.excedenteMinutos)}</TableCell>
                  <TableCell><BadgeAtividade atividade={item.atividade} /></TableCell>
                  <TableCell className="font-mono">{item.numViagem ?? "—"}</TableCell>
                  <TableCell className="font-mono tabular-nums">{textoFrota(item.cavalo, item.carreta)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </MolduraTabela>
      )}
    </div>
  )
}
