import { CalendarX } from "lucide-react"
import { requireSessaoPaginaComFilial } from "@/lib/auth-guard"
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
import { buscarEstourosSetimoDia } from "@/lib/queries/estouro-setimo-dia"
import { PERIODO_PADRAO } from "@/lib/relatorios/catalogo"
import { periodoOuPadrao } from "@/lib/relatorios/periodo"
import { formatarDiaCurto, formatarDuracao, formatarHorarioRelativo } from "@/lib/relatorios/formato"
import { MINIMO_HORAS_ENTRE_FOLGAS } from "@/lib/services/alocacao/disponibilidade"
import { MAX_DIAS_SEM_FOLGA } from "@/lib/services/dias-sem-folga"
import type { EstouroSetimoDia } from "@/lib/services/relatorios/jornada-analise"
import { formatarNomeProprio } from "@/lib/utils/texto"

type SearchParamsInput = { de?: string; ate?: string }

function Ocorrencia({ estouro }: { estouro: EstouroSetimoDia }) {
  if (estouro.tipo === "SETIMO_DIA") {
    return (
      <Badge variant="outline" className="border-destructive/30 bg-destructive/10 text-destructive">
        {estouro.diasSemFolga}º dia seguido
      </Badge>
    )
  }
  return (
    <div className="space-y-0.5">
      <Badge variant="outline" className="border-destructive/30 bg-destructive/10 text-destructive">
        Folga menor que {MINIMO_HORAS_ENTRE_FOLGAS}h
      </Badge>
      {estouro.folgaMinutos !== null && estouro.faltaramMinutos !== null && (
        <p className="text-xs tabular-nums">
          Folgou {formatarDuracao(estouro.folgaMinutos)} · faltou {formatarDuracao(estouro.faltaramMinutos)}
        </p>
      )}
    </div>
  )
}

export default async function EstouroSetimoDiaPage({ searchParams }: { searchParams?: Promise<SearchParamsInput> }) {
  const parametros = (await searchParams) ?? {}
  const { filialId } = await requireSessaoPaginaComFilial()
  const periodo = periodoOuPadrao(parametros.de, parametros.ate, PERIODO_PADRAO.estouroSetimoDia)
  const estouros = await buscarEstourosSetimoDia(filialId, periodo.de, periodo.ate)

  return (
    <div className="space-y-6">
      <CabecalhoRelatorio titulo="Estouro de 7º dia">
        Pelo relatório de jornada: motorista que trabalhou o {MAX_DIAS_SEM_FOLGA + 1}º dia seguido (ou mais) sem folga, ou que folgou menos
        de <strong>{MINIMO_HORAS_ENTRE_FOLGAS}h</strong> depois do {MAX_DIAS_SEM_FOLGA}º dia. Costuma acontecer quando ele bate o ponto
        antes da hora na volta do descanso.
      </CabecalhoRelatorio>

      <FiltroRelatorio
        action="/relatorios/estouro-7-dia"
        periodo={periodo}
        exportarTipo="estouro-7-dia"
        exportarQuery={{ de: periodo.deTexto, ate: periodo.ateTexto }}
      />

      {estouros.length === 0 ? (
        <EmptyState
          icone={CalendarX}
          titulo="Nenhum estouro de 7º dia"
          descricao={`Ninguém passou de ${MAX_DIAS_SEM_FOLGA} dias seguidos nem folgou menos de ${MINIMO_HORAS_ENTRE_FOLGAS}h no período.`}
        />
      ) : (
        <MolduraTabela>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Dia</TableHead>
                <TableHead>Motorista</TableHead>
                <TableHead>Turno</TableHead>
                <TableHead>Ocorrência</TableHead>
                <TableHead>Parou (6º dia)</TableHead>
                <TableHead>Início</TableHead>
                <TableHead>Fim</TableHead>
                <TableHead>Atividade</TableHead>
                <TableHead>Nº Viagem</TableHead>
                <TableHead>Frota</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {estouros.map((estouro) => (
                <TableRow
                  key={`${estouro.tipo}-${estouro.motoristaId}-${estouro.dia.toISOString()}-${estouro.inicio?.toISOString() ?? ""}`}
                  className="bg-destructive/10 text-destructive hover:bg-destructive/15"
                >
                  <TableCell className="tabular-nums">{formatarDiaCurto(estouro.dia)}</TableCell>
                  <TableCell className="font-medium">{formatarNomeProprio(estouro.motorista)}</TableCell>
                  <TableCell>
                    <BadgeTurno turno={estouro.turno} />
                  </TableCell>
                  <TableCell>
                    <Ocorrencia estouro={estouro} />
                  </TableCell>
                  <TableCell className="font-mono tabular-nums">
                    {estouro.fimAnterior ? formatarHorarioRelativo(estouro.fimAnterior, estouro.dia) : "—"}
                  </TableCell>
                  <TableCell className="font-mono tabular-nums">
                    {estouro.inicio ? formatarHorarioRelativo(estouro.inicio, estouro.dia) : "—"}
                  </TableCell>
                  <TableCell className="font-mono tabular-nums">
                    {estouro.fim ? formatarHorarioRelativo(estouro.fim, estouro.dia) : "—"}
                  </TableCell>
                  <TableCell>
                    <BadgeAtividade atividade={estouro.atividade} />
                  </TableCell>
                  <TableCell className="font-mono">{estouro.numViagem ?? "—"}</TableCell>
                  <TableCell className="font-mono tabular-nums">{textoFrota(estouro.cavalo, estouro.carreta)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </MolduraTabela>
      )}
    </div>
  )
}
