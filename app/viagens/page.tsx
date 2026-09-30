import Link from "next/link"
import { requireSessaoPaginaComFilial } from "@/lib/auth-guard"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"
import { Badge } from "@/components/ui/badge"
import { Alert } from "@/components/ui/alert"
import { Download, Pencil, PlusCircle, Truck } from "lucide-react"
import { AcoesLinha, BotaoIcone } from "@/components/ui/botao-icone"
import { buscarViagensPaginadas } from "@/lib/queries/viagens"
import { STATUS_VIAGEM_OPCOES, formatarStatusViagem } from "@/lib/services/viagem-status.service"
import { montarQueryFiltroViagens, parseFiltroListaViagens, type FiltroListaViagens } from "@/lib/services/filtro-viagens"
import { NomeMotorista } from "@/components/motorista/icone-tipo-motorista"
import { Input } from "@/components/ui/input"
import AtualizarStatusRapido from "./atualizar-status-rapido"
import ExcluirViagemButton from "./excluir-viagem-button"
import { classeBadgeTurno } from "./badge-styles"
import { formatDateForDateInput, formatarDataHoraPtBr } from "@/lib/utils/date-format"
import { formatarCodigoFrota } from "@/lib/services/frota-regras"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

type Viagem = Awaited<ReturnType<typeof buscarViagensPaginadas>>["viagens"][number]

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
      <NomeMotorista nome={viagem.motorista.nome} tipo={viagem.motorista.tipo} className="font-medium text-foreground" />
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
    <AcoesLinha>
      {/* prefetch desligado: é um download de arquivo, não uma página. */}
      <BotaoIcone href={`/api/viagens/${viagem.id}/excel`} prefetch={false} rotulo="Baixar Excel da viagem" icone={Download} />
      <BotaoIcone href={`/viagens/editar/${viagem.id}`} rotulo="Editar viagem" icone={Pencil} />
      {podeExcluir && <ExcluirViagemButton viagemId={viagem.id} numeroViagem={viagem.numViagem} />}
    </AcoesLinha>
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

function FiltrosViagens({ filtro }: { filtro: FiltroListaViagens }) {
  // Formulário GET comum: mudar o período ou buscar volta pra página 1 e
  // mantém o status escolhido — sem JavaScript, a URL é o estado.
  return (
    <form method="get" action="/viagens" className="flex flex-wrap items-end gap-3 rounded-lg border bg-card p-3">
      {filtro.status !== "TODOS" && <input type="hidden" name="status" value={filtro.status} />}
      <label className="grid gap-1 text-xs text-muted-foreground">
        De
        <Input type="date" name="de" defaultValue={formatDateForDateInput(filtro.de)} className="h-8 w-40 text-xs" />
      </label>
      <label className="grid gap-1 text-xs text-muted-foreground">
        Até
        <Input type="date" name="ate" defaultValue={formatDateForDateInput(filtro.ate)} className="h-8 w-40 text-xs" />
      </label>
      <label className="grid gap-1 text-xs text-muted-foreground">
        Nº da viagem
        <Input name="q" defaultValue={filtro.busca} placeholder="Buscar em todo o histórico" className="h-8 w-52 text-xs" />
      </label>
      <Button type="submit" size="sm" variant="outline">Filtrar</Button>
      {(filtro.busca || filtro.status !== "TODOS") && (
        <Link href="/viagens" className="text-xs text-muted-foreground underline-offset-4 hover:underline">
          Limpar filtros
        </Link>
      )}
    </form>
  )
}

function Paginacao({ filtro, totalPaginas, total }: { filtro: FiltroListaViagens; totalPaginas: number; total: number }) {
  if (totalPaginas <= 1) return null

  const anterior = filtro.pagina > 1 ? `/viagens${montarQueryFiltroViagens(filtro, { pagina: filtro.pagina - 1 })}` : null
  const proxima = filtro.pagina < totalPaginas ? `/viagens${montarQueryFiltroViagens(filtro, { pagina: filtro.pagina + 1 })}` : null

  return (
    <nav aria-label="Paginação" className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
      <span>
        Página <span className="tabular-nums">{filtro.pagina}</span> de <span className="tabular-nums">{totalPaginas}</span> ·{" "}
        <span className="tabular-nums">{total}</span> viagens
      </span>
      <div className="flex gap-2">
        {anterior ? (
          <Link href={anterior}><Button size="sm" variant="outline">Anterior</Button></Link>
        ) : (
          <Button size="sm" variant="outline" disabled>Anterior</Button>
        )}
        {proxima ? (
          <Link href={proxima}><Button size="sm" variant="outline">Próxima</Button></Link>
        ) : (
          <Button size="sm" variant="outline" disabled>Próxima</Button>
        )}
      </div>
    </nav>
  )
}

type SearchParamsInput = {
  status?: string
  de?: string
  ate?: string
  q?: string
  pagina?: string
}

export default async function ViagensPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParamsInput>
}) {
  const filtro = parseFiltroListaViagens((await searchParams) ?? {})
  const filtroStatus = filtro.status
  const { session, filialId } = await requireSessaoPaginaComFilial()
  const podeExcluir = session.user.role === "ADMIN"
  const { viagens: viagensFiltradas, total, totalPaginas } = await buscarViagensPaginadas(filialId, filtro)

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Gestão de Viagens</h1>
          <p className="text-muted-foreground mt-1">Acompanhe e gerencie as viagens por status.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href={`/viagens${montarQueryFiltroViagens(filtro, { status: "TODOS", pagina: 1 })}`}>
            <Button variant={filtroStatus === "TODOS" ? "default" : "outline"}>Todos</Button>
          </Link>
          {STATUS_VIAGEM_OPCOES.map((status) => (
            <Link key={status.valor} href={`/viagens${montarQueryFiltroViagens(filtro, { status: status.valor, pagina: 1 })}`}>
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

      <FiltrosViagens filtro={filtro} />

      {viagensFiltradas.length === 0 ? (
        <EmptyState
          icone={Truck}
          titulo="Nenhuma viagem"
          descricao={filtro.busca ? "Nenhuma viagem com esse número." : "Nenhuma viagem nesse período para este filtro."}
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
              {filtroStatus === "TODOS" ? "Viagens" : `Status: ${formatarStatusViagem(filtroStatus)}`}
            </h2>
            <Badge variant="outline">{total}</Badge>
          </div>
          <ViagensTabela viagens={viagensFiltradas} podeExcluir={podeExcluir} />
          <ViagensCards viagens={viagensFiltradas} podeExcluir={podeExcluir} />
          <Paginacao filtro={filtro} totalPaginas={totalPaginas} total={total} />
        </section>
      )}
    </div>
  )
}
