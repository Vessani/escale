import Link from "next/link"
import { BedDouble, Gauge, Route, Ticket } from "lucide-react"
import { requireSessaoPaginaComFilial } from "@/lib/auth-guard"
import { EmptyState } from "@/components/ui/empty-state"
import { StatCard } from "@/components/ui/stat-card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { CabecalhoRelatorio, FiltroRelatorio, MolduraTabela } from "@/components/relatorio/pagina-relatorio"
import { buscarMotoristasDoFiltro, buscarViagensKmCustos, parseMotoristaFiltro } from "@/lib/queries/relatorios/km-custos"
import { PERIODO_PADRAO } from "@/lib/relatorios/catalogo"
import { periodoOuPadrao } from "@/lib/relatorios/periodo"
import { relatorioViagens, STATUS_RELATORIO_VIAGENS } from "@/lib/services/relatorios/viagens"
import { formatarStatusViagem } from "@/lib/services/viagem-status.service"
import { formatarReais, formatarReaisOuTraco } from "@/lib/utils/dinheiro"
import { formatarDataHoraPtBr } from "@/lib/utils/date-format"
import { formatarNomeProprio } from "@/lib/utils/texto"
import { formatarKm } from "@/lib/utils/numero"

export const metadata = { title: "Viagens" }

type SearchParamsInput = { de?: string; ate?: string; motorista?: string }

/** Todas as viagens do período, uma por linha — o resumo pra conferir km, despesas e por onde passou. */
export default async function RelatorioViagensPage({ searchParams }: { searchParams?: Promise<SearchParamsInput> }) {
  const parametros = (await searchParams) ?? {}
  const { filialId } = await requireSessaoPaginaComFilial()
  const periodo = periodoOuPadrao(parametros.de, parametros.ate, PERIODO_PADRAO.viagens)
  const motoristaId = parseMotoristaFiltro(parametros.motorista)
  const [viagens, motoristas] = await Promise.all([
    buscarViagensKmCustos(filialId, periodo.de, periodo.ate, motoristaId, STATUS_RELATORIO_VIAGENS),
    buscarMotoristasDoFiltro(filialId),
  ])
  const { linhas, totais } = relatorioViagens(viagens)

  return (
    <div className="space-y-6">
      <CabecalhoRelatorio titulo="Viagens">
        Todas as viagens do período (menos canceladas), uma por linha. Km, pedágio e pernoite vêm do que o motorista registrou no celular.
        Cidades = clientes com SAP code e número white, na ordem da rota.
      </CabecalhoRelatorio>

      <FiltroRelatorio
        action="/relatorios/viagens"
        periodo={periodo}
        exportarTipo="viagens"
        exportarQuery={{ de: periodo.deTexto, ate: periodo.ateTexto, motorista: motoristaId }}
      >
        <label className="grid gap-1 text-xs text-muted-foreground">
          Motorista
          <select
            name="motorista"
            defaultValue={motoristaId ?? ""}
            className="h-8 w-56 rounded-md border border-input bg-background px-2 text-xs text-foreground"
          >
            <option value="">Todos</option>
            {motoristas.map((motorista) => (
              <option key={motorista.id} value={motorista.id}>
                {formatarNomeProprio(motorista.nome)}
              </option>
            ))}
          </select>
        </label>
      </FiltroRelatorio>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard rotulo="Viagens" valor={totais.viagens} icone={Route} />
        <StatCard
          rotulo={totais.viagensComKm < totais.viagens ? `Km total · ${totais.viagensComKm} com km` : "Km total"}
          valor={totais.viagensComKm ? formatarKm(totais.kmRodado) : "—"}
          icone={Gauge}
        />
        <StatCard rotulo="Pedágio" valor={formatarReais(totais.pedagioCentavos)} icone={Ticket} />
        <StatCard rotulo="Pernoite" valor={formatarReais(totais.pernoiteCentavos)} icone={BedDouble} />
      </div>

      {linhas.length === 0 ? (
        <EmptyState icone={Route} titulo="Nenhuma viagem no período" descricao="Ajuste o período ou o motorista." />
      ) : (
        <MolduraTabela>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nº Viagem</TableHead>
                <TableHead>Data</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Motorista</TableHead>
                <TableHead>Produto</TableHead>
                <TableHead>Cidades</TableHead>
                <TableHead className="text-right">Km inicial</TableHead>
                <TableHead className="text-right">Km final</TableHead>
                <TableHead className="text-right">Km total</TableHead>
                <TableHead className="text-right">Pedágio</TableHead>
                <TableHead className="text-right">Pernoite</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {linhas.map((linha) => (
                <TableRow key={linha.id} className="whitespace-nowrap">
                  <TableCell>
                    <Link href={`/viagens/editar/${linha.id}`} className="font-mono font-medium hover:underline">
                      {linha.numViagem}
                    </Link>
                  </TableCell>
                  <TableCell
                    className="tabular-nums"
                    title={linha.inicioEhPrevisto ? "Início previsto (ainda sem saída real)" : "Saída real"}
                  >
                    {formatarDataHoraPtBr(linha.inicio)}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{formatarStatusViagem(linha.status)}</TableCell>
                  <TableCell>{linha.motorista ? formatarNomeProprio(linha.motorista) : "—"}</TableCell>
                  <TableCell>{linha.produto ?? "—"}</TableCell>
                  <TableCell className="text-xs">{linha.regiao.length ? linha.regiao.join(" › ") : "—"}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatarKm(linha.kmInicial)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatarKm(linha.kmFinal)}</TableCell>
                  <TableCell className="text-right font-medium tabular-nums">{formatarKm(linha.kmRodado)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatarReaisOuTraco(linha.pedagioCentavos)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatarReaisOuTraco(linha.pernoiteCentavos)}</TableCell>
                </TableRow>
              ))}
              <TableRow className="bg-muted/50 font-semibold">
                <TableCell colSpan={8}>Total do período</TableCell>
                <TableCell className="text-right tabular-nums">{formatarKm(totais.kmRodado)}</TableCell>
                <TableCell className="text-right tabular-nums">{formatarReais(totais.pedagioCentavos)}</TableCell>
                <TableCell className="text-right tabular-nums">{formatarReais(totais.pernoiteCentavos)}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </MolduraTabela>
      )}
    </div>
  )
}
