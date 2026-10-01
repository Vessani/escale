import { Truck } from "lucide-react"
import { requireSessaoPaginaComFilial } from "@/lib/auth-guard"
import { Badge } from "@/components/ui/badge"
import { EmptyState } from "@/components/ui/empty-state"
import { StatCard } from "@/components/ui/stat-card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { CabecalhoRelatorio, FiltroRelatorio, MolduraTabela } from "@/components/relatorio/pagina-relatorio"
import { buscarDadosUsoFrota } from "@/lib/queries/relatorios/operacao"
import { PERIODO_PADRAO } from "@/lib/relatorios/catalogo"
import { diasNoPeriodo, periodoOuPadrao } from "@/lib/relatorios/periodo"
import { formatarDiaCompleto, formatarPercentual } from "@/lib/relatorios/formato"
import { usoDaFrota } from "@/lib/services/relatorios/operacao"
import { formatarCodigoFrota } from "@/lib/services/frota-regras"
import { formatarProduto } from "@/lib/services/produto.service"
import { cn } from "@/lib/utils"

type SearchParamsInput = { de?: string; ate?: string }

export default async function UsoFrotaPage({ searchParams }: { searchParams?: Promise<SearchParamsInput> }) {
  const parametros = (await searchParams) ?? {}
  const { filialId } = await requireSessaoPaginaComFilial()
  const periodo = periodoOuPadrao(parametros.de, parametros.ate, PERIODO_PADRAO.frota)
  const dados = await buscarDadosUsoFrota(filialId, periodo.de, periodo.ate)
  const frotas = usoDaFrota(dados.frotas, dados.viagens, periodo.de, periodo.ate, dados.ultimaViagemPorCarreta)
  const paradas = frotas.filter((frota) => frota.viagens === 0 && frota.diasOcupados === 0)
  const ocupacaoMedia = frotas.length ? frotas.reduce((soma, frota) => soma + frota.ocupacao, 0) / frotas.length : 0

  return (
    <div className="space-y-6">
      <CabecalhoRelatorio titulo="Uso da frota">
        Quantos dias cada conjunto ficou em viagem no período ({diasNoPeriodo(periodo)} dias). A carreta identifica o
        conjunto. Os parados aparecem primeiro.
      </CabecalhoRelatorio>

      <FiltroRelatorio
        action="/relatorios/frota"
        periodo={periodo}
        exportarTipo="frota"
        exportarQuery={{ de: periodo.deTexto, ate: periodo.ateTexto }}
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <StatCard rotulo="Conjuntos cadastrados" valor={frotas.length} icone={Truck} />
        <StatCard rotulo="Parados no período" valor={paradas.length} icone={Truck} classeValor={paradas.length > 0 ? "text-warning" : undefined} />
        <StatCard rotulo="Ocupação média" valor={formatarPercentual(ocupacaoMedia)} icone={Truck} />
      </div>

      {frotas.length === 0 ? (
        <EmptyState icone={Truck} titulo="Nenhum conjunto cadastrado" descricao="Cadastre os conjuntos em Frotas." />
      ) : (
        <MolduraTabela>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cavalo / Carreta</TableHead>
                <TableHead>Produto</TableHead>
                <TableHead className="text-right">Viagens</TableHead>
                <TableHead className="text-right">Dias em viagem</TableHead>
                <TableHead className="w-48">Ocupação</TableHead>
                <TableHead>Última viagem</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {frotas.map((frota) => (
                <TableRow key={frota.id} className={cn(frota.viagens === 0 && frota.diasOcupados === 0 && "bg-warning/10 hover:bg-warning/15")}>
                  <TableCell className="font-mono tabular-nums">
                    {formatarCodigoFrota(frota.cavalo)} / {formatarCodigoFrota(frota.carreta)}
                    {frota.emManutencao && <Badge variant="outline" className="ml-2">Manutenção</Badge>}
                  </TableCell>
                  <TableCell>{frota.tipoProduto ? formatarProduto(frota.tipoProduto) : "—"}</TableCell>
                  <TableCell className="text-right tabular-nums">{frota.viagens}</TableCell>
                  <TableCell className="text-right tabular-nums">{frota.diasOcupados}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted" aria-hidden>
                        <div className="h-full rounded-full bg-primary" style={{ width: `${Math.round(frota.ocupacao * 100)}%` }} />
                      </div>
                      <span className="w-10 text-right text-xs tabular-nums">{formatarPercentual(frota.ocupacao)}</span>
                    </div>
                  </TableCell>
                  <TableCell className="tabular-nums">{frota.ultimaViagem ? formatarDiaCompleto(frota.ultimaViagem) : "Nunca"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </MolduraTabela>
      )}
    </div>
  )
}
