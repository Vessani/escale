import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft, Clock, Download, MapPin, Receipt, Repeat, Route, Wrench } from "lucide-react"
import { requireSessaoPaginaComFilial } from "@/lib/auth-guard"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { carregarRelatorioViagem } from "@/lib/relatorios/relatorio-viagem"
import type { TipoEvento } from "@/lib/services/relatorio-viagem"
import { formatarNumero } from "@/lib/services/descarga"
import { formatarStatusViagem } from "@/lib/services/viagem-status.service"
import { formatarCodigoFrota } from "@/lib/services/frota-regras"
import { formatarDuracao } from "@/lib/relatorios/formato"
import { classeBadgeStatusViagem } from "@/app/viagens/badge-styles"
import { formatarReais } from "@/lib/utils/dinheiro"
import { formatarDataHoraPtBr } from "@/lib/utils/date-format"
import { cn } from "@/lib/utils"

export const metadata = { title: "Relatório da viagem" }

const quando = (data: Date | null | undefined) => (data ? formatarDataHoraPtBr(data) : "—")
const km = (valor: number | null | undefined) => (valor === null || valor === undefined ? "—" : valor.toLocaleString("pt-BR"))

function Secao({ titulo, icone: Icone, children }: { titulo: string; icone: typeof Route; children: React.ReactNode }) {
  return (
    <section className="space-y-3 rounded-lg border bg-card p-4 shadow-sm">
      <h2 className="flex items-center gap-2 text-base font-semibold">
        <Icone className="size-4 text-primary" aria-hidden /> {titulo}
      </h2>
      {children}
    </section>
  )
}

function Dado({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg bg-muted/60 px-3 py-2">
      <dt className="text-xs text-muted-foreground">{rotulo}</dt>
      <dd className="font-medium">{children}</dd>
    </div>
  )
}

const COR_EVENTO: Record<TipoEvento, string> = {
  STATUS: "bg-muted-foreground",
  SAIDA: "bg-chart-2",
  CHEGADA: "bg-info",
  DESPESA: "bg-warning",
  TROCA: "bg-primary",
  PROBLEMA: "bg-destructive",
  FIM: "bg-success",
}

export default async function RelatorioViagemPage({ params }: { params: Promise<{ id: string }> }) {
  const { filialId } = await requireSessaoPaginaComFilial()
  const id = Number((await params).id)
  const r = Number.isInteger(id) && id > 0 ? await carregarRelatorioViagem(filialId, id) : null
  if (!r) notFound()

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link href={`/viagens/editar/${r.id}`} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" aria-hidden /> Voltar para a viagem
        </Link>
        <Button asChild>
          <a href={`/api/viagens/${r.id}/relatorio`}>
            <Download className="mr-1.5 size-4" aria-hidden /> Baixar Excel
          </a>
        </Button>
      </div>

      <header className="space-y-1">
        <p className="text-sm text-muted-foreground">Relatório da viagem</p>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-mono text-2xl font-semibold">{r.numViagem}</h1>
          <Badge variant="outline" className={classeBadgeStatusViagem(r.status)}>{formatarStatusViagem(r.status)}</Badge>
          {r.problemaMecanico && <Badge variant="outline" className="border-destructive/30 bg-destructive/10 text-destructive">Problema mecânico</Badge>}
        </div>
      </header>

      <Secao titulo="Resumo" icone={Route}>
        <dl className="grid grid-cols-2 gap-2 text-sm md:grid-cols-4">
          <Dado rotulo={r.teveTroca ? "Motorista (atual)" : "Motorista"}>{r.motorista ?? "—"}</Dado>
          <Dado rotulo="Acompanhante">{r.acompanhante ?? "—"}</Dado>
          <Dado rotulo="Frota">
            <span className="font-mono">{formatarCodigoFrota(r.cavalo)} / {formatarCodigoFrota(r.carreta)}</span>
          </Dado>
          <Dado rotulo="Produto">{r.produto ?? "—"}</Dado>
          <Dado rotulo="Início previsto">{quando(r.inicioPrevisto)}</Dado>
          <Dado rotulo="Fim previsto">{quando(r.fimPrevisto)}</Dado>
          <Dado rotulo="Saída real">
            {quando(r.saidaReal)}
            {r.atrasoMinutos ? (
              <span className="block text-xs text-warning">+{formatarDuracao(r.atrasoMinutos)}{r.motivoAtraso ? ` · ${r.motivoAtraso}` : ""}</span>
            ) : null}
          </Dado>
          <Dado rotulo={r.encerramento.rotulo}>{quando(r.encerramento.quando)}</Dado>
          <Dado rotulo="Km inicial"><span className="tabular-nums">{km(r.kmInicial)}</span></Dado>
          <Dado rotulo="Km final"><span className="tabular-nums">{km(r.kmFinal)}</span></Dado>
          <Dado rotulo="Km rodado"><span className="tabular-nums">{r.kmRodado === null ? "—" : `${km(r.kmRodado)} km`}</span></Dado>
          <Dado rotulo="Pedágio + pernoite"><span className="tabular-nums">{formatarReais(r.pedagioCentavos + r.pernoiteCentavos)}</span></Dado>
        </dl>
      </Secao>

      <Secao titulo={`Entregas e chegadas (${r.entregas.length})`} icone={MapPin}>
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Entrega prevista</TableHead>
                <TableHead>Chegada</TableHead>
                <TableHead className="text-right">Km</TableHead>
                <TableHead>Medição</TableHead>
                <TableHead className="text-right">Nível inicial → final</TableHead>
                <TableHead className="text-right">Descarregado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {r.entregas.map((entrega) => (
                <TableRow key={entrega.id}>
                  <TableCell className="tabular-nums">{entrega.ordem}</TableCell>
                  <TableCell>
                    <span className="font-medium">{entrega.cliente}</span>
                    <span className="block text-[11px] text-muted-foreground">{entrega.cidade}</span>
                  </TableCell>
                  <TableCell className="whitespace-nowrap tabular-nums">{quando(entrega.prevista)}</TableCell>
                  <TableCell className="whitespace-nowrap tabular-nums">
                    {entrega.chegada ? quando(entrega.chegada.quando) : <span className="text-muted-foreground">não registrada</span>}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{entrega.chegada ? km(entrega.chegada.km) : "—"}</TableCell>
                  <TableCell>{entrega.chegada?.medicao ?? "—"}</TableCell>
                  <TableCell className="text-right tabular-nums">{entrega.chegada?.leituras ?? "—"}</TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">
                    {entrega.chegada ? `${formatarNumero(entrega.chegada.total)} ${entrega.chegada.unidade}`.trim() : "—"}
                  </TableCell>
                </TableRow>
              ))}
              {r.totaisDescarga.length > 0 && (
                <TableRow className="bg-muted/50 font-semibold">
                  <TableCell colSpan={7}>Total descarregado</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {r.totaisDescarga.map(({ unidade, total }) => (
                      <span key={unidade} className="block">{`${formatarNumero(total)} ${unidade}`.trim()}</span>
                    ))}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </Secao>

      <div className="grid gap-5 md:grid-cols-2">
        <Secao titulo="Despesas" icone={Receipt}>
          {r.despesas.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma despesa lançada.</p>
          ) : (
            <ul className="divide-y rounded-lg border text-sm">
              {r.despesas.map((d) => (
                <li key={d.id} className="flex justify-between px-3 py-2">
                  <span>{d.tipo} <span className="text-xs text-muted-foreground">{quando(d.quando)}</span></span>
                  <span className="tabular-nums">{formatarReais(d.centavos)}</span>
                </li>
              ))}
            </ul>
          )}
          <dl className="grid grid-cols-3 gap-2 text-sm">
            <Dado rotulo="Pedágio"><span className="tabular-nums">{formatarReais(r.pedagioCentavos)}</span></Dado>
            <Dado rotulo="Pernoite"><span className="tabular-nums">{formatarReais(r.pernoiteCentavos)}</span></Dado>
            <Dado rotulo="Total"><span className="tabular-nums">{formatarReais(r.pedagioCentavos + r.pernoiteCentavos)}</span></Dado>
          </dl>
        </Secao>

        <div className="space-y-5">
          <Secao titulo="Troca de motorista" icone={Repeat}>
            {r.trocas.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sem troca de motorista.</p>
            ) : (
              <ol className="divide-y rounded-lg border text-sm">
                {r.trocas.map((t) => (
                  <li key={t.id} className="space-y-0.5 px-3 py-2">
                    <p className="font-medium">{t.de} → {t.para}</p>
                    <p className="text-xs text-muted-foreground">{quando(t.quando)} · km {km(t.km)} · {t.local}</p>
                    <p className="text-xs">Motivo: {t.motivo}</p>
                  </li>
                ))}
              </ol>
            )}
          </Secao>
          <Secao titulo="Problema mecânico" icone={Wrench}>
            {r.problemaMecanico ? (
              <p className="text-sm">
                <span className="font-medium text-destructive">{r.problemaMecanico}</span>
                <span className="block text-xs text-muted-foreground">Informado em {quando(r.problemaMecanicoEm)}</span>
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">Nenhum problema informado.</p>
            )}
          </Secao>
        </div>
      </div>

      <Secao titulo="Linha do tempo" icone={Clock}>
        {r.linhaDoTempo.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nada registrado ainda.</p>
        ) : (
          <ol className="relative space-y-3 border-l pl-5">
            {r.linhaDoTempo.map((evento, indice) => (
              <li key={indice} className="relative">
                <span aria-hidden className={cn("absolute -left-[25px] top-1.5 size-2.5 rounded-full ring-4 ring-card", COR_EVENTO[evento.tipo])} />
                <p className="text-xs tabular-nums text-muted-foreground">
                  {quando(evento.quando)}
                  {evento.quem && ` · ${evento.quem}`}
                </p>
                <p className="text-sm font-medium">{evento.titulo}</p>
                {evento.detalhe && <p className="text-sm text-muted-foreground">{evento.detalhe}</p>}
              </li>
            ))}
          </ol>
        )}
      </Secao>
    </div>
  )
}
