import Link from "next/link"
import { Gauge, Route, Truck, Wrench } from "lucide-react"
import { requireSessaoPaginaComFilial } from "@/lib/auth-guard"
import { EmptyState } from "@/components/ui/empty-state"
import { StatCard } from "@/components/ui/stat-card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { CabecalhoRelatorio, FiltroRelatorio, MolduraTabela, SecaoRelatorio } from "@/components/relatorio/pagina-relatorio"
import { buscarDadosDisponibilidade } from "@/lib/queries/relatorios/operacao"
import { PERIODO_PADRAO } from "@/lib/relatorios/catalogo"
import { periodoOuPadrao } from "@/lib/relatorios/periodo"
import { formatarDiaCompleto, formatarDuracaoLonga as formatarDuracao, formatarPercentual } from "@/lib/relatorios/formato"
import { disponibilidadeDaFrota, type DisponibilidadeVeiculo } from "@/lib/services/relatorios/operacao"
import { cn } from "@/lib/utils"

type SearchParamsInput = { de?: string; ate?: string }

/** Barra empilhada: rota (azul), manutenção WM (vermelho), Ritmo (laranja), disponível sem uso (cinza). */
function BarraTempo({ item }: { item: DisponibilidadeVeiculo }) {
  const total = Math.max(item.minutosPeriodo, 1)
  const partes = [
    { minutos: item.minutosEmRota, classe: "bg-primary", rotulo: "Em rota" },
    { minutos: item.minutosManutencaoWhiteMartins, classe: "bg-destructive", rotulo: "Manutenção White Martins" },
    { minutos: item.minutosManutencaoRitmo, classe: "bg-warning", rotulo: "Manutenção Ritmo" },
  ]
  return (
    <div
      className="flex h-2 w-full overflow-hidden rounded-full bg-muted"
      title={partes.map((p) => `${p.rotulo}: ${formatarDuracao(p.minutos)}`).join(" · ") + ` · Disponível sem uso: ${formatarDuracao(item.minutosDisponivelParado)}`}
    >
      {partes.map((parte) => (
        <div key={parte.rotulo} className={parte.classe} style={{ width: `${(parte.minutos / total) * 100}%` }} />
      ))}
    </div>
  )
}

function TabelaVeiculos({ itens }: { itens: DisponibilidadeVeiculo[] }) {
  return (
    <MolduraTabela>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Veículo</TableHead>
            <TableHead className="w-56">Tempo no período</TableHead>
            <TableHead className="text-right">Em rota</TableHead>
            <TableHead className="text-right">Manut. White Martins</TableHead>
            <TableHead className="text-right">Manut. Ritmo</TableHead>
            <TableHead className="text-right">Disponível sem uso</TableHead>
            <TableHead className="text-right">Disponibilidade</TableHead>
            <TableHead className="text-right">Utilização</TableHead>
            <TableHead className="text-right">Viagens</TableHead>
            <TableHead>Última viagem</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {itens.map((item) => (
            <TableRow key={`${item.veiculo}-${item.codigo}`}>
              <TableCell>
                <div className="font-mono font-medium">{item.codigo}</div>
                {item.conjunto && <div className="text-xs text-muted-foreground">Conjunto {item.conjunto}</div>}
              </TableCell>
              <TableCell><BarraTempo item={item} /></TableCell>
              <TableCell className="text-right tabular-nums">{formatarDuracao(item.minutosEmRota)}</TableCell>
              <TableCell className={cn("text-right tabular-nums", item.minutosManutencaoWhiteMartins > 0 && "text-destructive")}>
                {item.minutosManutencaoWhiteMartins ? formatarDuracao(item.minutosManutencaoWhiteMartins) : "—"}
              </TableCell>
              <TableCell className={cn("text-right tabular-nums", item.minutosManutencaoRitmo > 0 && "text-warning")}>
                {item.minutosManutencaoRitmo ? formatarDuracao(item.minutosManutencaoRitmo) : "—"}
              </TableCell>
              <TableCell className="text-right tabular-nums text-muted-foreground">{formatarDuracao(item.minutosDisponivelParado)}</TableCell>
              <TableCell className={cn("text-right tabular-nums font-medium", item.disponibilidade < 0.9 && "text-destructive")}>
                {formatarPercentual(item.disponibilidade)}
              </TableCell>
              <TableCell className="text-right tabular-nums">{formatarPercentual(item.utilizacao)}</TableCell>
              <TableCell className="text-right tabular-nums">{item.viagens}</TableCell>
              <TableCell className="tabular-nums">{item.ultimaViagem ? formatarDiaCompleto(item.ultimaViagem) : "Nunca"}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </MolduraTabela>
  )
}

export default async function DisponibilidadeFrotaPage({ searchParams }: { searchParams?: Promise<SearchParamsInput> }) {
  const parametros = (await searchParams) ?? {}
  const { filialId } = await requireSessaoPaginaComFilial()
  const periodo = periodoOuPadrao(parametros.de, parametros.ate, PERIODO_PADRAO.frota)
  const agora = new Date()
  const dados = await buscarDadosDisponibilidade(filialId, periodo.de, periodo.ate)
  const itens = disponibilidadeDaFrota(dados.veiculos, dados.viagens, dados.manutencoes, periodo.de, periodo.ate, agora, dados.ultimaViagemPorVeiculo)

  const carretas = itens.filter((item) => item.veiculo === "CARRETA")
  const cavalos = itens.filter((item) => item.veiculo === "CAVALO")
  const media = (lista: DisponibilidadeVeiculo[], campo: "disponibilidade" | "utilizacao") =>
    lista.length ? lista.reduce((soma, item) => soma + item[campo], 0) / lista.length : 0
  const soma = (campo: "minutosManutencaoWhiteMartins" | "minutosManutencaoRitmo") => itens.reduce((total, item) => total + item[campo], 0)

  return (
    <div className="space-y-6">
      <CabecalhoRelatorio titulo="Disponibilidade da frota">
        Como o tempo de cada carreta e cavalo se dividiu no período: em rota, parado em manutenção (por responsável) e
        disponível sem uso. Conta só até agora. As manutenções vêm da agenda em{" "}
        <Link href="/frotas/manutencoes" className="underline underline-offset-4">Frotas → Manutenções</Link>.
      </CabecalhoRelatorio>

      <FiltroRelatorio
        action="/relatorios/frota"
        periodo={periodo}
        exportarTipo="frota"
        exportarQuery={{ de: periodo.deTexto, ate: periodo.ateTexto }}
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard rotulo="Disponibilidade média (carretas)" valor={formatarPercentual(media(carretas, "disponibilidade"))} icone={Gauge} />
        <StatCard rotulo="Utilização média (carretas)" valor={formatarPercentual(media(carretas, "utilizacao"))} icone={Route} />
        <StatCard
          rotulo="Parado · White Martins"
          valor={formatarDuracao(soma("minutosManutencaoWhiteMartins"))}
          icone={Wrench}
          classeValor={soma("minutosManutencaoWhiteMartins") > 0 ? "text-destructive" : undefined}
        />
        <StatCard
          rotulo="Parado · Ritmo"
          valor={formatarDuracao(soma("minutosManutencaoRitmo"))}
          icone={Wrench}
          classeValor={soma("minutosManutencaoRitmo") > 0 ? "text-warning" : undefined}
        />
      </div>

      <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-primary" /> Em rota</span>
        <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-destructive" /> Manutenção White Martins</span>
        <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-warning" /> Manutenção Ritmo</span>
        <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-muted ring-1 ring-border" /> Disponível sem uso</span>
      </div>

      {itens.length === 0 ? (
        <EmptyState icone={Truck} titulo="Nenhum veículo" descricao="Cadastre os conjuntos em Frotas." />
      ) : (
        <>
          <SecaoRelatorio titulo={`Carretas · ${carretas.length}`} descricao="Menor disponibilidade primeiro.">
            <TabelaVeiculos itens={carretas} />
          </SecaoRelatorio>
          {cavalos.length > 0 && (
            <SecaoRelatorio titulo={`Cavalos · ${cavalos.length}`} descricao="Truck (cavalo e carreta com o mesmo número) aparece só em Carretas.">
              <TabelaVeiculos itens={cavalos} />
            </SecaoRelatorio>
          )}
        </>
      )}
    </div>
  )
}
