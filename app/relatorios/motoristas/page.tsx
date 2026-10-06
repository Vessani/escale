import Link from "next/link"
import { AlertTriangle, CalendarCheck, Clock, UserX, Users } from "lucide-react"
import { requireSessaoPaginaComFilial } from "@/lib/auth-guard"
import { EmptyState } from "@/components/ui/empty-state"
import { StatCard } from "@/components/ui/stat-card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { BadgeTurno, CabecalhoRelatorio, FiltroRelatorio, MolduraTabela } from "@/components/relatorio/pagina-relatorio"
import { carregarDadosJornada } from "@/lib/queries/relatorios/jornada"
import { PERIODO_PADRAO } from "@/lib/relatorios/catalogo"
import { periodoOuPadrao, type Periodo } from "@/lib/relatorios/periodo"
import { formatarDuracao } from "@/lib/relatorios/formato"
import { painelPorMotorista } from "@/lib/services/relatorios/jornada-analise"
import { formatarNomeProprio } from "@/lib/utils/texto"
import { cn } from "@/lib/utils"

type SearchParamsInput = { de?: string; ate?: string }

/** Número de alertas: zero apagado; acima de zero em vermelho e linkando pro relatório detalhado do mesmo período. */
function CelulaAlerta({ valor, relatorio, periodo }: { valor: number; relatorio: string; periodo: Periodo }) {
  if (valor === 0) return <TableCell className="text-center tabular-nums text-muted-foreground/60">0</TableCell>
  return (
    <TableCell className="text-center tabular-nums">
      <Link
        href={`/relatorios/${relatorio}?de=${periodo.deTexto}&ate=${periodo.ateTexto}`}
        className="font-semibold text-destructive underline-offset-4 hover:underline"
      >
        {valor}
      </Link>
    </TableCell>
  )
}

export default async function PainelMotoristasPage({ searchParams }: { searchParams?: Promise<SearchParamsInput> }) {
  const parametros = (await searchParams) ?? {}
  const { filialId } = await requireSessaoPaginaComFilial()
  const periodo = periodoOuPadrao(parametros.de, parametros.ate, PERIODO_PADRAO.motoristas)
  const dados = await carregarDadosJornada(filialId, periodo.de, periodo.ate)
  const linhas = painelPorMotorista(dados.motoristas, dados.jornadas, dados.viagens, periodo.de, periodo.ate)

  const comAlerta = linhas.filter((linha) => linha.totalAlertas > 0).length
  const trabalharam = linhas.filter((linha) => linha.diasTrabalhados > 0)
  const mediaHoras = trabalharam.length
    ? trabalharam.reduce((soma, linha) => soma + linha.horasTrabalhadasMinutos, 0) / trabalharam.length
    : 0

  return (
    <div className="space-y-6">
      <CabecalhoRelatorio titulo="Painel por motorista">
        Quanto cada motorista trabalhou no período (pelo relatório de jornada), quantas viagens fez no Escalador e quantas vezes caiu em
        cada alerta. Quem precisa de atenção aparece primeiro. Clique num número vermelho para ver os detalhes.
      </CabecalhoRelatorio>

      <FiltroRelatorio
        action="/relatorios/motoristas"
        periodo={periodo}
        exportarTipo="motoristas"
        exportarQuery={{ de: periodo.deTexto, ate: periodo.ateTexto }}
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard
          rotulo="Motoristas com alerta"
          valor={comAlerta}
          icone={AlertTriangle}
          classeValor={comAlerta > 0 ? "text-destructive" : undefined}
        />
        <StatCard rotulo="Trabalharam no período" valor={trabalharam.length} icone={CalendarCheck} />
        <StatCard rotulo="Média de horas por motorista" valor={formatarDuracao(mediaHoras)} icone={Clock} />
        <StatCard
          rotulo="Sem jornada nem viagem"
          valor={linhas.filter((l) => l.diasTrabalhados === 0 && l.viagens === 0).length}
          icone={UserX}
        />
      </div>

      {linhas.length === 0 ? (
        <EmptyState icone={Users} titulo="Nenhum motorista cadastrado" />
      ) : (
        <MolduraTabela>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Motorista</TableHead>
                <TableHead>Turno</TableHead>
                <TableHead className="text-right">Dias</TableHead>
                <TableHead className="text-right">Horas</TableHead>
                <TableHead className="text-right">Maior jornada</TableHead>
                <TableHead className="text-right">Viagens</TableHead>
                <TableHead className="text-center">Circadiano</TableHead>
                <TableHead className="text-center">Estouro 7º dia</TableHead>
                <TableHead className="text-center">Quebra interstício</TableHead>
                <TableHead className="text-center">Estouro jornada</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {linhas.map((linha) => (
                <TableRow
                  key={linha.motoristaId}
                  className={cn(linha.diasTrabalhados === 0 && linha.viagens === 0 && "text-muted-foreground")}
                >
                  <TableCell className="font-medium">{formatarNomeProprio(linha.motorista)}</TableCell>
                  <TableCell>
                    <BadgeTurno turno={linha.turno} />
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{linha.diasTrabalhados}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {linha.horasTrabalhadasMinutos ? formatarDuracao(linha.horasTrabalhadasMinutos) : "—"}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {linha.maiorJornadaMinutos ? formatarDuracao(linha.maiorJornadaMinutos) : "—"}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{linha.viagens}</TableCell>
                  <CelulaAlerta valor={linha.circadiano} relatorio="circadiano" periodo={periodo} />
                  <CelulaAlerta valor={linha.estourosSetimoDia} relatorio="estouro-7-dia" periodo={periodo} />
                  <CelulaAlerta valor={linha.quebrasIntersticio} relatorio="quebra-intersticio" periodo={periodo} />
                  <CelulaAlerta valor={linha.estourosJornada} relatorio="estouro-jornada" periodo={periodo} />
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </MolduraTabela>
      )}
    </div>
  )
}
