import { MoonStar } from "lucide-react"
import { requireSessaoPaginaComFilial } from "@/lib/auth-guard"
import { EmptyState } from "@/components/ui/empty-state"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  BadgeAtividade,
  BadgeTurno,
  CabecalhoRelatorio,
  FiltroRelatorio,
  MolduraTabela,
  SecaoRelatorio,
  textoFrota,
} from "@/components/relatorio/pagina-relatorio"
import { buscarRelatorioCircadiano } from "@/lib/queries/circadiano"
import { PERIODO_PADRAO } from "@/lib/relatorios/catalogo"
import { periodoOuPadrao } from "@/lib/relatorios/periodo"
import { formatarDiaCompleto, formatarDiaCurto, formatarHorarioRelativo } from "@/lib/relatorios/formato"
import { formatarExcedente, type OcorrenciaCircadiano } from "@/lib/services/circadiano.service"
import { formatarNomeProprio } from "@/lib/utils/texto"
import { formatarDataHoraPtBr, formatarHoraLocal } from "@/lib/utils/date-format"

type SearchParamsInput = { de?: string; ate?: string }

function TabelaOcorrencias({ ocorrencias }: { ocorrencias: OcorrenciaCircadiano[] }) {
  return (
    <MolduraTabela>
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
              <TableCell className="tabular-nums">{formatarDiaCurto(ocorrencia.dia)}</TableCell>
              <TableCell className="font-medium">{formatarNomeProprio(ocorrencia.motorista)}</TableCell>
              <TableCell>
                <BadgeTurno turno={ocorrencia.turno} />
              </TableCell>
              <TableCell className="font-mono tabular-nums">{formatarHorarioRelativo(ocorrencia.inicio, ocorrencia.dia)}</TableCell>
              <TableCell className="font-mono tabular-nums font-medium text-destructive">
                {formatarHorarioRelativo(ocorrencia.fim, ocorrencia.dia)}
              </TableCell>
              <TableCell className="tabular-nums" title={`Limite do turno: ${formatarDataHoraPtBr(ocorrencia.limite)}`}>
                +{formatarExcedente(ocorrencia.minutosExcedidos)}
                <span className="text-muted-foreground"> (após {formatarHoraLocal(ocorrencia.limite)})</span>
              </TableCell>
              <TableCell>
                <BadgeAtividade atividade={ocorrencia.atividade} />
              </TableCell>
              <TableCell className="font-mono">{ocorrencia.numViagem ?? "—"}</TableCell>
              <TableCell className="font-mono tabular-nums">
                {textoFrota(ocorrencia.cavalo, ocorrencia.carreta)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </MolduraTabela>
  )
}

export default async function CircadianoPage({ searchParams }: { searchParams?: Promise<SearchParamsInput> }) {
  const parametros = (await searchParams) ?? {}
  const { filialId } = await requireSessaoPaginaComFilial()
  const periodo = periodoOuPadrao(parametros.de, parametros.ate, PERIODO_PADRAO.circadiano)
  const relatorio = await buscarRelatorioCircadiano(filialId, periodo.de, periodo.ate)

  return (
    <div className="space-y-6">
      <CabecalhoRelatorio titulo="Ciclo circadiano">
        Jornada do dia que passa das <strong>22:00</strong> e da noite que passa das <strong>05:00</strong>. O turno é o de
        cada jornada, pelo horário de início: <strong>dia</strong> se começa entre 04:00 e 15:59, <strong>noite</strong> a partir
        das 16:00. Só entram motoristas cadastrados que aparecem no relatório de jornada.
      </CabecalhoRelatorio>

      <FiltroRelatorio
        action="/relatorios/circadiano"
        periodo={periodo}
        exportarTipo="circadiano"
        exportarQuery={{ de: periodo.deTexto, ate: periodo.ateTexto }}
      />

      <SecaoRelatorio
        titulo="Previsto — viagens agendadas"
        descricao={`Jornada estimada em até 12h a partir do início da viagem (ou até o fim previsto, se terminar antes).${
          relatorio.relatorioAte ? ` Só viagens depois de ${formatarDiaCompleto(relatorio.relatorioAte)}, último dia do relatório importado.` : ""
        }`}
      >
        {relatorio.previstas.length === 0 ? (
          <EmptyState icone={MoonStar} titulo="Nenhuma viagem agendada passa do horário" descricao="Nenhum motorista do relatório vai passar do limite do turno nas viagens desse período." />
        ) : (
          <TabelaOcorrencias ocorrencias={relatorio.previstas} />
        )}
      </SecaoRelatorio>

      <SecaoRelatorio
        titulo="Realizado — relatório de jornada"
        descricao="Início e fim reais do relatório importado, com a viagem do Escale que o motorista fazia no horário (sem viagem = Interno)."
      >
        {relatorio.realizadas.length === 0 ? (
          <EmptyState icone={MoonStar} titulo="Ninguém passou do horário" descricao="Nenhuma jornada do relatório nesse período terminou depois do limite do turno." />
        ) : (
          <TabelaOcorrencias ocorrencias={relatorio.realizadas} />
        )}
      </SecaoRelatorio>
    </div>
  )
}
