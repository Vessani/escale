import Link from "next/link"
import { Coins, Gauge, Receipt, Route, Wallet } from "lucide-react"
import { requireSessaoPaginaComFilial } from "@/lib/auth-guard"
import { EmptyState } from "@/components/ui/empty-state"
import { StatCard } from "@/components/ui/stat-card"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { CabecalhoRelatorio, FiltroRelatorio, MolduraTabela, textoFrota } from "@/components/relatorio/pagina-relatorio"
import { buscarMotoristasDoFiltro, buscarViagensKmCustos, parseMotoristaFiltro } from "@/lib/queries/relatorios/km-custos"
import { PERIODO_PADRAO } from "@/lib/relatorios/catalogo"
import { periodoOuPadrao } from "@/lib/relatorios/periodo"
import { parseFiltroRegistro, relatorioKmCustos } from "@/lib/services/relatorios/km-custos"
import { formatarStatusViagem } from "@/lib/services/viagem-status.service"
import { classeBadgeStatusViagem } from "@/app/viagens/badge-styles"
import { formatarReais } from "@/lib/utils/dinheiro"
import { formatarDataHoraPtBr } from "@/lib/utils/date-format"
import { formatarNomeProprio } from "@/lib/utils/texto"
import { cn } from "@/lib/utils"

export const metadata = { title: "Km e custos por viagem" }

type SearchParamsInput = { de?: string; ate?: string; motorista?: string; registro?: string }

const km = (valor: number | null) => (valor === null ? "—" : valor.toLocaleString("pt-BR"))
const reais = (centavos: number) => (centavos ? formatarReais(centavos) : "—")

export default async function KmCustosPage({ searchParams }: { searchParams?: Promise<SearchParamsInput> }) {
  const parametros = (await searchParams) ?? {}
  const { filialId } = await requireSessaoPaginaComFilial()
  const periodo = periodoOuPadrao(parametros.de, parametros.ate, PERIODO_PADRAO.kmCustos)
  const motoristaId = parseMotoristaFiltro(parametros.motorista)
  const [viagens, motoristas] = await Promise.all([
    buscarViagensKmCustos(filialId, periodo.de, periodo.ate, motoristaId),
    buscarMotoristasDoFiltro(filialId),
  ])
  const registro = parseFiltroRegistro(parametros.registro)
  const { linhas, totais } = relatorioKmCustos(viagens, registro)

  return (
    <div className="space-y-6">
      <CabecalhoRelatorio titulo="Km e custos por viagem">
        O que o motorista registrou no celular: km inicial e final, pedágios e pernoites. Entram as viagens iniciadas,
        retornando e finalizadas cujo início previsto cai no período. Região = cidades dos clientes com SAP code e número
        white.
      </CabecalhoRelatorio>

      <FiltroRelatorio
        action="/relatorios/km-custos"
        periodo={periodo}
        exportarTipo="km-custos"
        exportarQuery={{ de: periodo.deTexto, ate: periodo.ateTexto, motorista: motoristaId, registro: registro === "todas" ? "todas" : undefined }}
      >
        <label className="grid gap-1 text-xs text-muted-foreground">
          Viagens
          <select
            name="registro"
            defaultValue={registro}
            className="h-8 w-56 rounded-md border border-input bg-background px-2 text-xs text-foreground"
          >
            <option value="com-registro">Com registro do motorista</option>
            <option value="todas">Todas (inclui sem registro)</option>
          </select>
        </label>
        <label className="grid gap-1 text-xs text-muted-foreground">
          Motorista
          <select
            name="motorista"
            defaultValue={motoristaId ?? ""}
            className="h-8 w-56 rounded-md border border-input bg-background px-2 text-xs text-foreground"
          >
            <option value="">Todos</option>
            {motoristas.map((motorista) => (
              <option key={motorista.id} value={motorista.id}>{formatarNomeProprio(motorista.nome)}</option>
            ))}
          </select>
        </label>
      </FiltroRelatorio>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <StatCard rotulo="Viagens" valor={totais.viagens} icone={Route} />
        <StatCard
          rotulo={totais.viagensComKm < totais.viagens ? `Km rodado · ${totais.viagensComKm} com km` : "Km rodado"}
          valor={km(totais.kmRodado)}
          icone={Gauge}
        />
        <StatCard rotulo="Custo total" valor={formatarReais(totais.custoCentavos)} icone={Wallet} />
        <StatCard rotulo="Custo médio por viagem (com registro)" valor={totais.viagens ? formatarReais(totais.custoMedioPorViagemCentavos) : "—"} icone={Receipt} />
        <StatCard rotulo="Custo por km" valor={totais.custoPorKmCentavos === null ? "—" : formatarReais(totais.custoPorKmCentavos)} icone={Coins} />
      </div>

      {registro === "com-registro" && totais.semRegistro > 0 && (
        <p className="text-sm text-muted-foreground">
          {totais.semRegistro} viagem(ns) do período saíram sem nenhum registro do motorista (sem km nem despesa) e não aparecem aqui —{" "}
          escolha &quot;Todas&quot; no filtro pra ver.
        </p>
      )}

      {linhas.length === 0 ? (
        <EmptyState
          icone={Route}
          titulo="Nenhuma viagem no período"
          descricao="Só entram viagens que já saíram (iniciadas, retornando ou finalizadas) e, no filtro padrão, com km ou despesa lançados pelo motorista."
        />
      ) : (
        <MolduraTabela>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Viagem</TableHead>
                <TableHead>Motorista</TableHead>
                <TableHead>Início</TableHead>
                <TableHead>Fim</TableHead>
                <TableHead className="text-right">Km inicial</TableHead>
                <TableHead className="text-right">Km final</TableHead>
                <TableHead className="text-right">Km rodado</TableHead>
                <TableHead className="text-right">Pedágio</TableHead>
                <TableHead className="text-right">Pernoite</TableHead>
                <TableHead className="text-right">Custo total</TableHead>
                <TableHead>Região</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {linhas.map((linha) => (
                <TableRow key={linha.id}>
                  <TableCell>
                    <Link href={`/viagens/editar/${linha.id}`} className="font-mono font-medium hover:underline">{linha.numViagem}</Link>
                    <p className="font-mono text-[11px] text-muted-foreground">{textoFrota(linha.cavalo, linha.carreta)}</p>
                    {!linha.temRegistro && <p className="text-[11px] text-muted-foreground">sem registro do motorista</p>}
                    {linha.status !== "FINALIZADA" && (
                      <Badge variant="outline" className={cn("mt-1", classeBadgeStatusViagem(linha.status))}>{formatarStatusViagem(linha.status)}</Badge>
                    )}
                  </TableCell>
                  <TableCell>{linha.motorista ? formatarNomeProprio(linha.motorista) : "—"}</TableCell>
                  <TableCell className="whitespace-nowrap tabular-nums">
                    {formatarDataHoraPtBr(linha.inicio)}
                    {linha.inicioEhPrevisto && <p className="text-[11px] text-muted-foreground">previsto (sem saída real)</p>}
                  </TableCell>
                  <TableCell className="whitespace-nowrap tabular-nums">{linha.fim ? formatarDataHoraPtBr(linha.fim) : "—"}</TableCell>
                  <TableCell className="text-right tabular-nums">{km(linha.kmInicial)}</TableCell>
                  <TableCell className="text-right tabular-nums">{km(linha.kmFinal)}</TableCell>
                  <TableCell className="text-right font-medium tabular-nums">{km(linha.kmRodado)}</TableCell>
                  <TableCell className="text-right tabular-nums">{reais(linha.pedagioCentavos)}</TableCell>
                  <TableCell className="text-right tabular-nums">{reais(linha.pernoiteCentavos)}</TableCell>
                  <TableCell className="text-right font-medium tabular-nums">{reais(linha.custoCentavos)}</TableCell>
                  <TableCell className="text-xs">
                    {linha.regiao.length ? (
                      // Uma cidade por linha, na ordem da rota — não estica a tabela.
                      linha.regiao.map((cidade, indice) => (
                        <span key={cidade} className="block whitespace-nowrap">
                          {indice > 0 && <span className="text-muted-foreground">→ </span>}
                          {cidade}
                        </span>
                      ))
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              <TableRow className="bg-muted/50 font-semibold">
                <TableCell colSpan={6}>Total do período</TableCell>
                <TableCell className="text-right tabular-nums">{km(totais.kmRodado)}</TableCell>
                <TableCell className="text-right tabular-nums">{formatarReais(totais.pedagioCentavos)}</TableCell>
                <TableCell className="text-right tabular-nums">{formatarReais(totais.pernoiteCentavos)}</TableCell>
                <TableCell className="text-right tabular-nums">{formatarReais(totais.custoCentavos)}</TableCell>
                <TableCell />
              </TableRow>
            </TableBody>
          </Table>
        </MolduraTabela>
      )}
    </div>
  )
}
