import { CalendarX } from "lucide-react"
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
import { buscarFolgasEstouradas } from "@/lib/queries/sem-folga"
import { PERIODO_PADRAO } from "@/lib/relatorios/catalogo"
import { periodoOuPadrao } from "@/lib/relatorios/periodo"
import { formatarDiaCurto, formatarHorarioRelativo } from "@/lib/relatorios/formato"
import { MAX_DIAS_SEM_FOLGA } from "@/lib/services/dias-sem-folga"
import { formatarNomeProprio } from "@/lib/utils/texto"

type SearchParamsInput = { de?: string; ate?: string }

export default async function SemFolgaPage({ searchParams }: { searchParams?: Promise<SearchParamsInput> }) {
  const parametros = (await searchParams) ?? {}
  const { filialId } = await requireSessaoPaginaComFilial()
  const periodo = periodoOuPadrao(parametros.de, parametros.ate, PERIODO_PADRAO.semFolga)
  const registros = await buscarFolgasEstouradas(filialId, periodo.de, periodo.ate)

  return (
    <div className="space-y-6">
      <CabecalhoRelatorio titulo="Dias sem folga">
        Dias em que o relatório de jornada mostra o motorista trabalhando o {MAX_DIAS_SEM_FOLGA + 1}º dia seguido (ou mais) sem
        folga. Costuma acontecer quando ele bate o ponto antes da hora na volta do descanso.
      </CabecalhoRelatorio>

      <FiltroRelatorio
        action="/relatorios/sem-folga"
        periodo={periodo}
        exportarTipo="sem-folga"
        exportarQuery={{ de: periodo.deTexto, ate: periodo.ateTexto }}
      />

      {registros.length === 0 ? (
        <EmptyState
          icone={CalendarX}
          titulo={`Ninguém passou de ${MAX_DIAS_SEM_FOLGA} dias sem folga`}
          descricao="Vale a partir dos relatórios de jornada importados depois desta atualização."
        />
      ) : (
        <MolduraTabela>
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
                  <TableCell className="tabular-nums">{formatarDiaCurto(registro.dia)}</TableCell>
                  <TableCell className="font-medium">{formatarNomeProprio(registro.motorista)}</TableCell>
                  <TableCell><BadgeTurno turno={registro.turno} /></TableCell>
                  <TableCell className="font-semibold tabular-nums">{registro.diasSemFolga}º dia</TableCell>
                  <TableCell className="font-mono tabular-nums">{registro.inicio ? formatarHorarioRelativo(registro.inicio, registro.dia) : "—"}</TableCell>
                  <TableCell className="font-mono tabular-nums">{registro.fim ? formatarHorarioRelativo(registro.fim, registro.dia) : "—"}</TableCell>
                  <TableCell><BadgeAtividade atividade={registro.atividade} /></TableCell>
                  <TableCell className="font-mono">{registro.numViagem ?? "—"}</TableCell>
                  <TableCell className="font-mono tabular-nums">{textoFrota(registro.cavalo, registro.carreta)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </MolduraTabela>
      )}
    </div>
  )
}
