import Link from "next/link"
import { requireSessaoPaginaComFilial } from "@/lib/auth-guard"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"
import { Badge } from "@/components/ui/badge"
import { Alert } from "@/components/ui/alert"
import { Download, PlusCircle, Truck } from "lucide-react"
import { buscarViagens } from "@/lib/queries/viagens"
import { STATUS_VIAGEM_OPCOES, formatarStatusViagem, parseStatusFiltro } from "@/lib/services/viagem-status.service"
import AtualizarStatusRapido from "./atualizar-status-rapido"
import ExcluirViagemButton from "./excluir-viagem-button"
import { classeBadgeTurno } from "./badge-styles"
import { formatarDataHoraPtBr } from "@/lib/utils/date-format"
import { formatarCodigoFrota } from "@/lib/services/frota-regras"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

type Viagem = Awaited<ReturnType<typeof buscarViagens>>[number]

function MotoristaCelula({ viagem }: { viagem: Viagem }) {
  if (!viagem.motorista) {
    return (
      <Badge variant="warning">
        Pendente Alocação
      </Badge>
    )
  }

  return (
    <div className="space-y-1">
      <span className="text-foreground font-medium">{viagem.motorista.nome}</span>
      {viagem.avisoInterjornada && (
        <Alert variant="warning" inline title={viagem.avisoInterjornada}>
          Interjornada
        </Alert>
      )}
    </div>
  )
}

function FrotaCelula({ viagem }: { viagem: Viagem }) {
  return (
    <div className="text-sm">
      <div>
        <span className="font-mono font-medium tabular-nums text-foreground">{formatarCodigoFrota(viagem.cavalo)}</span>
        <span className="font-mono tabular-nums text-muted-foreground ml-1">/ {formatarCodigoFrota(viagem.carreta)}</span>
      </div>
      {viagem.avisoFrotaIndisponivel && (
        <Alert variant="warning" inline className="mt-1" title={viagem.avisoFrotaIndisponivel}>
          Frota indisponível
        </Alert>
      )}
      {viagem.avisoFrotaProdutoIncompativel && (
        <Alert variant="warning" inline className="mt-1" title={viagem.avisoFrotaProdutoIncompativel}>
          Frota de outro produto
        </Alert>
      )}
    </div>
  )
}

function AcoesViagem({ viagem, podeExcluir }: { viagem: Viagem; podeExcluir: boolean }) {
  return (
    <div className="flex flex-wrap justify-end gap-2">
      <Link href={`/api/viagens/${viagem.id}/excel`}>
        <Button variant="outline" size="sm">
          <Download className="h-4 w-4 mr-2" />
          Download
        </Button>
      </Link>
      <Link href={`/viagens/editar/${viagem.id}`}>
        <Button variant="outline" size="sm">Editar</Button>
      </Link>
      {podeExcluir && <ExcluirViagemButton viagemId={viagem.id} numeroViagem={viagem.numViagem} />}
    </div>
  )
}

/** Tabela para telas a partir de md; em telas menores vira lista de cards (ver ViagensCards). */
function ViagensTabela({ viagens, podeExcluir }: { viagens: Viagem[]; podeExcluir: boolean }) {
  return (
    <div className="hidden rounded-lg border bg-card shadow-sm overflow-hidden md:block">
      <Table containerClassName="max-h-[70vh] overflow-auto">
        <TableHeader className="sticky top-0 z-10 bg-muted">
          <TableRow>
            <TableHead>Nº Viagem</TableHead>
            <TableHead>Início Previsto</TableHead>
            <TableHead>Fim Previsto</TableHead>
            <TableHead>Turno</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Caminhão</TableHead>
            <TableHead>Motorista</TableHead>
            <TableHead className="text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {viagens.map((viagem: Viagem) => (
            <TableRow key={viagem.id}>
              <TableCell className="font-mono font-medium tabular-nums">{viagem.numViagem}</TableCell>
              <TableCell className="font-mono tabular-nums">{formatarDataHoraPtBr(viagem.inicioPrevisto)}</TableCell>
              <TableCell className="font-mono tabular-nums">{formatarDataHoraPtBr(viagem.fimPrevisto)}</TableCell>
              <TableCell>
                <Badge variant="outline" className={classeBadgeTurno(viagem.turno)}>
                  {viagem.turno}
                </Badge>
              </TableCell>
              <TableCell>
                <div className="space-y-1">
                  {viagem.viagemExtra && (
                    <Badge variant="outline" className="border-purple-500/30 bg-purple-500/10 text-purple-600 hover:bg-purple-500/10">
                      Extra
                    </Badge>
                  )}
                  <AtualizarStatusRapido viagemId={viagem.id} statusAtual={viagem.status} inicioPrevisto={viagem.inicioPrevisto} fimPrevisto={viagem.fimPrevisto} />
                </div>
              </TableCell>
              <TableCell>
                <FrotaCelula viagem={viagem} />
              </TableCell>
              <TableCell>
                <MotoristaCelula viagem={viagem} />
              </TableCell>
              <TableCell className="text-right">
                <AcoesViagem viagem={viagem} podeExcluir={podeExcluir} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

/** Lista em cards para telas abaixo de md; substitui a tabela (ver ViagensTabela). */
function ViagensCards({ viagens, podeExcluir }: { viagens: Viagem[]; podeExcluir: boolean }) {
  return (
    <div className="space-y-3 md:hidden">
      {viagens.map((viagem) => (
        <div key={viagem.id} className="space-y-3 rounded-lg border bg-card shadow-sm p-4">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="font-mono font-semibold tabular-nums text-foreground">{viagem.numViagem}</p>
              <p className="font-mono text-xs tabular-nums text-muted-foreground">
                {formatarDataHoraPtBr(viagem.inicioPrevisto)} até {formatarDataHoraPtBr(viagem.fimPrevisto)}
              </p>
            </div>
            <Badge variant="outline" className={classeBadgeTurno(viagem.turno)}>
              {viagem.turno}
            </Badge>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {viagem.viagemExtra && (
              <Badge variant="outline" className="border-purple-500/30 bg-purple-500/10 text-purple-600 hover:bg-purple-500/10">
                Extra
              </Badge>
            )}
            <AtualizarStatusRapido viagemId={viagem.id} statusAtual={viagem.status} inicioPrevisto={viagem.inicioPrevisto} fimPrevisto={viagem.fimPrevisto} />
          </div>

          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <div>
              <dt className="text-xs text-muted-foreground">Caminhão</dt>
              <dd className="font-mono font-medium tabular-nums text-foreground">{formatarCodigoFrota(viagem.cavalo)} / {formatarCodigoFrota(viagem.carreta)}</dd>
              {viagem.avisoFrotaIndisponivel && (
                <Alert variant="warning" inline className="mt-1" title={viagem.avisoFrotaIndisponivel}>
                  Frota indisponível
                </Alert>
              )}
              {viagem.avisoFrotaProdutoIncompativel && (
                <Alert variant="warning" inline className="mt-1" title={viagem.avisoFrotaProdutoIncompativel}>
                  Frota de outro produto
                </Alert>
              )}
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Motorista</dt>
              <dd><MotoristaCelula viagem={viagem} /></dd>
            </div>
          </dl>

          <AcoesViagem viagem={viagem} podeExcluir={podeExcluir} />
        </div>
      ))}
    </div>
  )
}

type SearchParamsInput = {
  status?: string
}

export default async function ViagensPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParamsInput>
}) {
  const parametros = (await searchParams) ?? {}
  const filtroStatus = parseStatusFiltro(parametros.status)
  const { session, filialId } = await requireSessaoPaginaComFilial()
  const podeExcluir = session.user.role === "ADMIN"
  const viagens = await buscarViagens(filialId)
  const viagensFiltradas =
    filtroStatus === "TODOS" ? viagens : viagens.filter((viagem) => viagem.status === filtroStatus)

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Gestão de Viagens</h1>
          <p className="text-muted-foreground mt-1">Acompanhe e gerencie as viagens por status.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/viagens">
            <Button variant={filtroStatus === "TODOS" ? "default" : "outline"}>Todos</Button>
          </Link>
          {STATUS_VIAGEM_OPCOES.map((status) => (
            <Link key={status.valor} href={`/viagens?status=${status.valor}`}>
              <Button variant={filtroStatus === status.valor ? "default" : "outline"}>
                {status.label}
              </Button>
            </Link>
          ))}
          <Link href="/viagens/alocacao">
            <Button variant="outline">Alocação Manual</Button>
          </Link>
          <Link href="/viagens/nova">
            <Button>
              <PlusCircle className="w-5 h-5 mr-2" />
              Nova Viagem
            </Button>
          </Link>
        </div>
      </div>

      {viagensFiltradas.length === 0 ? (
        <EmptyState
          icone={Truck}
          titulo="Nenhuma viagem"
          descricao="Nenhuma viagem encontrada para este filtro."
          acao={
            <Link href="/viagens/nova">
              <Button>
                <PlusCircle className="w-4 h-4 mr-2" />
                Nova viagem
              </Button>
            </Link>
          }
        />
      ) : (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-foreground">
              {filtroStatus === "TODOS" ? "Todas as viagens" : `Status: ${formatarStatusViagem(filtroStatus)}`}
            </h2>
            <Badge variant="outline">{viagensFiltradas.length}</Badge>
          </div>
          <ViagensTabela viagens={viagensFiltradas} podeExcluir={podeExcluir} />
          <ViagensCards viagens={viagensFiltradas} podeExcluir={podeExcluir} />
        </section>
      )}
    </div>
  )
}