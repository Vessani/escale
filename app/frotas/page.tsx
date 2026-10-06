import Link from "next/link"
import { requireSessaoPaginaComFilial } from "@/lib/auth-guard"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"
import { Badge } from "@/components/ui/badge"
import { Pencil, PlusCircle, Truck, Wrench } from "lucide-react"
import { buscarFrotas } from "@/lib/queries/frotas"
import { buscarManutencoesEmAberto } from "@/lib/queries/manutencoes"
import {
  ROTULO_VEICULO,
  descreverTipo,
  fimEfetivo,
  manutencaoAtualOuProxima,
  situacaoManutencao,
  type ManutencaoBase,
} from "@/lib/services/manutencao-regras"
import { calcularStatusFrota } from "@/lib/services/frota-regras"
import { formatarProduto } from "@/lib/services/produto.service"
import { formatarDataHoraPtBr } from "@/lib/utils/date-format"
import ExcluirFrotaButton from "./excluir-frota-button"
import { AcoesLinha, BotaoIcone } from "@/components/ui/botao-icone"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

type Frota = Awaited<ReturnType<typeof buscarFrotas>>[number]

/** Até quando vai a manutenção, em texto curto pro badge. */
function textoFimManutencao(manutencao: ManutencaoBase, agora: Date) {
  if (situacaoManutencao(manutencao, agora) === "ATRASADA") return "passou da previsão"
  const fim = fimEfetivo(manutencao, agora)
  return fim ? `até ${formatarDataHoraPtBr(fim)}` : "sem previsão de fim"
}

const DIAS_AVISO_AGENDADA = 14

/**
 * Situação real do conjunto: manutenção em andamento no cavalo ou na
 * carreta vence; senão viagem/disponível. Embaixo, a próxima manutenção
 * agendada (até 14 dias), pra quem aloca já ver.
 */
function StatusFrotaBadge({ frota, agora, manutencoes }: { frota: Frota; agora: Date; manutencoes: ManutencaoBase[] }) {
  const doCavalo = manutencaoAtualOuProxima(manutencoes, "CAVALO", frota.cavalo, agora)
  const daCarreta = manutencaoAtualOuProxima(manutencoes, "CARRETA", frota.carreta, agora)
  const atual = daCarreta.atual ?? doCavalo.atual
  const proxima = [doCavalo.proxima, daCarreta.proxima]
    .filter((m): m is ManutencaoBase => m !== null)
    .sort((a, b) => new Date(a.inicioPrevisto).getTime() - new Date(b.inicioPrevisto).getTime())[0]
  const mostrarProxima =
    proxima && new Date(proxima.inicioPrevisto).getTime() - agora.getTime() <= DIAS_AVISO_AGENDADA * 24 * 60 * 60 * 1000

  const status = calcularStatusFrota(Boolean(atual), frota.disponivelEm, agora)

  return (
    <div className="flex flex-col items-start gap-1">
      {status === "MANUTENCAO" && atual ? (
        <Badge
          variant={situacaoManutencao(atual, agora) === "ATRASADA" ? "destructive" : "warning"}
          className="tabular-nums"
          title={atual.descricao ?? undefined}
        >
          {ROTULO_VEICULO[atual.veiculo]} em manutenção · {textoFimManutencao(atual, agora)}
        </Badge>
      ) : status === "EM_VIAGEM" ? (
        <Badge variant="info" className="tabular-nums">
          Em viagem até {formatarDataHoraPtBr(frota.disponivelEm as Date)}
        </Badge>
      ) : (
        <Badge variant="success">Disponível</Badge>
      )}
      {mostrarProxima && (
        <span className="flex items-center gap-1 text-xs text-muted-foreground tabular-nums">
          <Wrench className="size-3" aria-hidden />
          {descreverTipo(proxima)} ({ROTULO_VEICULO[proxima.veiculo].toLowerCase()}) em {formatarDataHoraPtBr(proxima.inicioPrevisto)}
        </span>
      )}
    </div>
  )
}

function AcoesFrota({ frota, podeExcluir }: { frota: Frota; podeExcluir: boolean }) {
  return (
    <AcoesLinha>
      <BotaoIcone
        href={`/frotas/manutencoes/nova?cavalo=${encodeURIComponent(frota.cavalo)}&carreta=${encodeURIComponent(frota.carreta)}`}
        rotulo="Agendar manutenção"
        icone={Wrench}
      />
      <BotaoIcone href={`/frotas/editar/${frota.id}`} rotulo="Editar conjunto" icone={Pencil} />
      {podeExcluir && <ExcluirFrotaButton frotaId={frota.id} cavalo={frota.cavalo} carreta={frota.carreta} />}
    </AcoesLinha>
  )
}

/** Tabela para telas a partir de md; em telas menores vira lista de cards (ver FrotasCards). */
function FrotasTabela({
  frotas,
  agora,
  podeExcluir,
  manutencoes,
}: {
  frotas: Frota[]
  agora: Date
  podeExcluir: boolean
  manutencoes: ManutencaoBase[]
}) {
  return (
    <div className="hidden rounded-lg border bg-card shadow-sm overflow-hidden md:block">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Cavalo</TableHead>
            <TableHead>Carreta</TableHead>
            <TableHead>Produto</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {frotas.map((frota) => (
            <TableRow key={frota.id}>
              <TableCell className="font-mono font-medium tabular-nums">{frota.cavalo}</TableCell>
              <TableCell className="font-mono tabular-nums">{frota.carreta}</TableCell>
              <TableCell className="text-muted-foreground">{formatarProduto(frota.tipoProduto)}</TableCell>
              <TableCell>
                <StatusFrotaBadge frota={frota} agora={agora} manutencoes={manutencoes} />
              </TableCell>
              <TableCell className="text-right">
                <AcoesFrota frota={frota} podeExcluir={podeExcluir} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

/** Lista em cards para telas abaixo de md; substitui a tabela (ver FrotasTabela). */
function FrotasCards({
  frotas,
  agora,
  podeExcluir,
  manutencoes,
}: {
  frotas: Frota[]
  agora: Date
  podeExcluir: boolean
  manutencoes: ManutencaoBase[]
}) {
  return (
    <div className="space-y-3 md:hidden">
      {frotas.map((frota) => (
        <div key={frota.id} className="space-y-3 rounded-lg border bg-card shadow-sm p-4">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="font-mono font-semibold tabular-nums text-foreground">
                {frota.cavalo} / {frota.carreta}
              </p>
              <p className="text-xs text-muted-foreground">{formatarProduto(frota.tipoProduto)}</p>
            </div>
            <StatusFrotaBadge frota={frota} agora={agora} manutencoes={manutencoes} />
          </div>
          <AcoesFrota frota={frota} podeExcluir={podeExcluir} />
        </div>
      ))}
    </div>
  )
}

export default async function FrotasPage() {
  const { session, filialId } = await requireSessaoPaginaComFilial()
  const podeExcluir = session.user.role === "ADMIN"
  const [frotas, manutencoes] = await Promise.all([buscarFrotas(filialId), buscarManutencoesEmAberto(filialId)])
  const agora = new Date()

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Frotas</h1>
          <p className="text-muted-foreground mt-1">Cadastro dos conjuntos (cavalo/carreta) e a disponibilidade de cada um.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/frotas/manutencoes">
            <Button variant="outline">
              <Wrench className="w-4 h-4 mr-2" />
              Manutenções
            </Button>
          </Link>
          <Link href="/frotas/novo">
            <Button>
              <PlusCircle className="w-5 h-5 mr-2" />
              Novo Conjunto
            </Button>
          </Link>
        </div>
      </div>

      {frotas.length === 0 ? (
        <EmptyState
          icone={Truck}
          titulo="Nenhum conjunto"
          descricao="Nenhum conjunto (cavalo/carreta) cadastrado ainda."
          acao={
            <Link href="/frotas/novo">
              <Button>
                <PlusCircle className="w-4 h-4 mr-2" />
                Novo conjunto
              </Button>
            </Link>
          }
        />
      ) : (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-foreground">Todos os conjuntos</h2>
            <Badge variant="outline">{frotas.length}</Badge>
          </div>
          <FrotasTabela frotas={frotas} agora={agora} podeExcluir={podeExcluir} manutencoes={manutencoes} />
          <FrotasCards frotas={frotas} agora={agora} podeExcluir={podeExcluir} manutencoes={manutencoes} />
        </section>
      )}
    </div>
  )
}
