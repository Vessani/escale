import Link from "next/link"
import { BedDouble } from "lucide-react"
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
import { PERIODO_PADRAO } from "@/lib/relatorios/catalogo"
import { periodoOuPadrao } from "@/lib/relatorios/periodo"
import { formatarDiaCurto, formatarDuracao, formatarHorarioRelativo } from "@/lib/relatorios/formato"
import { quebrasDeIntersticio } from "@/lib/services/relatorios/jornada-analise"
import { MINIMO_HORAS_ENTRE_JORNADAS } from "@/lib/services/alocacao/disponibilidade"
import { formatarNomeProprio } from "@/lib/utils/texto"

type SearchParamsInput = { de?: string; ate?: string }

export default async function QuebraIntersticioPage({ searchParams }: { searchParams?: Promise<SearchParamsInput> }) {
  const parametros = (await searchParams) ?? {}
  const { filialId } = await requireSessaoPaginaComFilial()
  const periodo = periodoOuPadrao(parametros.de, parametros.ate, PERIODO_PADRAO.quebraIntersticio)
  const dados = await carregarDadosJornada(filialId, periodo.de, periodo.ate)
  const ocorrencias = quebrasDeIntersticio(dados.motoristas, dados.jornadas, dados.viagens, periodo.de, periodo.ate)

  return (
    <div className="space-y-6">
      <CabecalhoRelatorio titulo="Quebra de interstício">
        O que aconteceu de verdade, pelo relatório de jornada: motoristas que voltaram a trabalhar antes de{" "}
        <strong>{MINIMO_HORAS_ENTRE_JORNADAS}h</strong> de descanso. A folga de 35h depois do 6º dia fica no{" "}
        <Link href="/relatorios/estouro-7-dia" className="font-medium text-primary underline-offset-4 hover:underline">
          Estouro de 7º dia
        </Link>
        . O aviso da alocação é a previsão; aqui é o realizado.
      </CabecalhoRelatorio>

      <FiltroRelatorio
        action="/relatorios/quebra-intersticio"
        periodo={periodo}
        exportarTipo="quebra-intersticio"
        exportarQuery={{ de: periodo.deTexto, ate: periodo.ateTexto }}
      />

      {ocorrencias.length === 0 ? (
        <EmptyState icone={BedDouble} titulo={`Todos descansaram as ${MINIMO_HORAS_ENTRE_JORNADAS}h`} descricao="Nenhuma jornada do período começou antes do descanso mínimo." />
      ) : (
        <MolduraTabela>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Dia</TableHead>
                <TableHead>Motorista</TableHead>
                <TableHead>Turno</TableHead>
                <TableHead>Parou</TableHead>
                <TableHead>Voltou</TableHead>
                <TableHead>Descansou</TableHead>
                <TableHead>Faltou</TableHead>
                <TableHead>Atividade</TableHead>
                <TableHead>Nº Viagem</TableHead>
                <TableHead>Frota</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ocorrencias.map((item) => (
                <TableRow key={`${item.motoristaId}-${item.inicioSeguinte.toISOString()}`}>
                  <TableCell className="tabular-nums">{formatarDiaCurto(item.inicioSeguinte)}</TableCell>
                  <TableCell className="font-medium">{formatarNomeProprio(item.motorista)}</TableCell>
                  <TableCell><BadgeTurno turno={item.turno} /></TableCell>
                  <TableCell className="font-mono tabular-nums">{formatarHorarioRelativo(item.fimAnterior, item.inicioSeguinte)}</TableCell>
                  <TableCell className="font-mono tabular-nums">{formatarHorarioRelativo(item.inicioSeguinte, item.inicioSeguinte)}</TableCell>
                  <TableCell className="tabular-nums">{formatarDuracao(item.descansoMinutos)}</TableCell>
                  <TableCell className="tabular-nums font-medium text-destructive">{formatarDuracao(item.faltaramMinutos)}</TableCell>
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
