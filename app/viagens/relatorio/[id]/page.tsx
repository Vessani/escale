import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft, Clock, MapPin, Receipt, Repeat, Route, Wrench } from "lucide-react"
import type { StatusViagem } from "@prisma/client"
import { requireSessaoPaginaComFilial } from "@/lib/auth-guard"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { buscarRelatorioViagem } from "@/lib/queries/relatorio-viagem"
import { montarLinhaDoTempo, mudancasDeStatus, type TipoEvento } from "@/lib/services/relatorio-viagem"
import { formatarNumero, textoLeituras, textoMedicao, unidadeDescarga } from "@/lib/services/descarga"
import { formatarStatusViagem } from "@/lib/services/viagem-status.service"
import { formatarCodigoFrota } from "@/lib/services/frota-regras"
import { formatarProduto } from "@/lib/services/produto.service"
import { minutosDeAtraso } from "@/lib/services/pontualidade"
import { formatarDuracao } from "@/lib/relatorios/formato"
import { classeBadgeStatusViagem } from "@/app/viagens/badge-styles"
import { formatarReais } from "@/lib/utils/dinheiro"
import { formatarDataHoraPtBr } from "@/lib/utils/date-format"
import { formatarNomeProprio } from "@/lib/utils/texto"
import { cn } from "@/lib/utils"
import { BotaoImprimir } from "./botao-imprimir"

export const metadata = { title: "Relatório da viagem" }

const quando = (data: Date | null | undefined) => (data ? formatarDataHoraPtBr(data) : "—")
const km = (valor: number | null | undefined) => (valor === null || valor === undefined ? "—" : valor.toLocaleString("pt-BR"))
const nome = (texto: string | null | undefined) => (texto ? formatarNomeProprio(texto) : "—")

function Secao({ titulo, icone: Icone, children }: { titulo: string; icone: typeof Route; children: React.ReactNode }) {
  return (
    <section className="space-y-3 break-inside-avoid rounded-lg border bg-card p-4 shadow-sm print:shadow-none">
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
  const dados = Number.isInteger(id) && id > 0 ? await buscarRelatorioViagem(filialId, id) : null
  if (!dados) notFound()
  const { viagem, historico } = dados

  const kmRodado = viagem.kmInicial !== null && viagem.kmFinal !== null ? viagem.kmFinal - viagem.kmInicial : null
  const atraso = viagem.horarioRealSaida ? minutosDeAtraso(viagem.inicioPrevisto, viagem.horarioRealSaida) : null
  const somaDespesa = (tipo: "PEDAGIO" | "PERNOITE") => viagem.despesas.filter((d) => d.tipo === tipo).reduce((t, d) => t + d.valorCentavos, 0)

  const chegadas = viagem.entregas.flatMap((entrega) =>
    entrega.chegada
      ? [{
          entrega,
          chegada: {
            ...entrega.chegada,
            nivelInicial: Number(entrega.chegada.nivelInicial),
            nivelFinal: Number(entrega.chegada.nivelFinal),
            polInicial: entrega.chegada.polInicial === null ? null : Number(entrega.chegada.polInicial),
            polFinal: entrega.chegada.polFinal === null ? null : Number(entrega.chegada.polFinal),
            fator: entrega.chegada.fator === null ? null : Number(entrega.chegada.fator),
            totalDescarregado: Number(entrega.chegada.totalDescarregado),
          },
        }]
      : [],
  )
  const chegadaDa = new Map(chegadas.map((c) => [c.entrega.id, c.chegada]))
  // Total descarregado por unidade (m³, kg, ou sem unidade no manômetro).
  const totaisDescarga = new Map<string, number>()
  for (const { chegada } of chegadas) {
    const unidade = unidadeDescarga(chegada)
    totaisDescarga.set(unidade, (totaisDescarga.get(unidade) ?? 0) + chegada.totalDescarregado)
  }

  const linhaDoTempo = montarLinhaDoTempo({
    rotuloStatus: (status: StatusViagem) => formatarStatusViagem(status),
    mudancasStatus: mudancasDeStatus(historico),
    saida: viagem.horarioRealSaida ? { quando: viagem.horarioRealSaida, km: viagem.kmInicial, motivoAtraso: viagem.motivoAtraso } : null,
    chegadas: chegadas.map(({ entrega, chegada }) => ({
      quando: chegada.chegadaEm,
      cliente: entrega.cliente,
      km: chegada.km,
      total: `${formatarNumero(chegada.totalDescarregado)} ${unidadeDescarga(chegada)}`.trim(),
    })),
    despesas: viagem.despesas.map((d) => ({ quando: d.registradoEm, tipo: d.tipo === "PEDAGIO" ? "Pedágio" : "Pernoite", valor: formatarReais(d.valorCentavos) })),
    trocas: viagem.trocas.map((t) => ({
      quando: t.trocadoEm,
      de: nome(t.motoristaAnterior.nome),
      para: nome(t.motoristaNovo.nome),
      km: t.km,
      local: t.local,
      motivo: t.motivo,
    })),
    problema: viagem.problemaMecanico && viagem.problemaMecanicoEm ? { quando: viagem.problemaMecanicoEm, texto: viagem.problemaMecanico } : null,
    fim:
      viagem.status === "FINALIZADA" && viagem.finalizadoEm
        ? { quando: viagem.finalizadoEm, status: "FINALIZADA", km: viagem.kmFinal }
        : viagem.status === "CANCELADA" && viagem.canceladoEm
          ? { quando: viagem.canceladoEm, status: "CANCELADA", km: null }
          : null,
  })

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <div className="nao-imprimir flex flex-wrap items-center justify-between gap-2">
        <Link href={`/viagens/editar/${viagem.id}`} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" aria-hidden /> Voltar para a viagem
        </Link>
        <BotaoImprimir />
      </div>

      <header className="space-y-1">
        <p className="text-sm text-muted-foreground">Relatório da viagem · gerado em {formatarDataHoraPtBr(new Date())}</p>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-mono text-2xl font-semibold">{viagem.numViagem}</h1>
          <Badge variant="outline" className={classeBadgeStatusViagem(viagem.status)}>{formatarStatusViagem(viagem.status)}</Badge>
          {viagem.problemaMecanico && <Badge variant="outline" className="border-destructive/30 bg-destructive/10 text-destructive">Problema mecânico</Badge>}
        </div>
      </header>

      <Secao titulo="Resumo" icone={Route}>
        <dl className="grid grid-cols-2 gap-2 text-sm md:grid-cols-4">
          <Dado rotulo={viagem.trocas.length ? "Motorista (atual)" : "Motorista"}>{nome(viagem.motorista?.nome)}</Dado>
          <Dado rotulo="Acompanhante">{nome(viagem.motoristaAcompanhante?.nome)}</Dado>
          <Dado rotulo="Frota">
            <span className="font-mono">{formatarCodigoFrota(viagem.cavalo)} / {formatarCodigoFrota(viagem.carreta)}</span>
          </Dado>
          <Dado rotulo="Produto">{viagem.produto ? formatarProduto(viagem.produto) : "—"}</Dado>
          <Dado rotulo="Início previsto">{quando(viagem.inicioPrevisto)}</Dado>
          <Dado rotulo="Fim previsto">{quando(viagem.fimPrevisto)}</Dado>
          <Dado rotulo="Saída real">
            {quando(viagem.horarioRealSaida)}
            {atraso !== null && atraso > 0 && <span className="block text-xs text-warning">+{formatarDuracao(atraso)}{viagem.motivoAtraso ? ` · ${viagem.motivoAtraso}` : ""}</span>}
          </Dado>
          <Dado rotulo={viagem.status === "CANCELADA" ? "Cancelada em" : "Encerrada em"}>
            {quando(viagem.status === "CANCELADA" ? viagem.canceladoEm : viagem.finalizadoEm)}
          </Dado>
          <Dado rotulo="Km inicial"><span className="tabular-nums">{km(viagem.kmInicial)}</span></Dado>
          <Dado rotulo="Km final"><span className="tabular-nums">{km(viagem.kmFinal)}</span></Dado>
          <Dado rotulo="Km rodado"><span className="tabular-nums">{kmRodado === null ? "—" : `${km(kmRodado)} km`}</span></Dado>
          <Dado rotulo="Pedágio + pernoite"><span className="tabular-nums">{formatarReais(somaDespesa("PEDAGIO") + somaDespesa("PERNOITE"))}</span></Dado>
        </dl>
      </Secao>

      <Secao titulo={`Entregas e chegadas (${viagem.entregas.length})`} icone={MapPin}>
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
              {viagem.entregas.map((entrega, indice) => {
                const chegada = chegadaDa.get(entrega.id)
                return (
                  <TableRow key={entrega.id}>
                    <TableCell className="tabular-nums">{indice + 1}</TableCell>
                    <TableCell>
                      <span className="font-medium">{entrega.cliente}</span>
                      <span className="block text-[11px] text-muted-foreground">{formatarNomeProprio(entrega.cidade)}/{entrega.uf}</span>
                    </TableCell>
                    <TableCell className="whitespace-nowrap tabular-nums">{quando(entrega.dataEntrega)}</TableCell>
                    <TableCell className="whitespace-nowrap tabular-nums">{chegada ? quando(chegada.chegadaEm) : <span className="text-muted-foreground">não registrada</span>}</TableCell>
                    <TableCell className="text-right tabular-nums">{chegada ? km(chegada.km) : "—"}</TableCell>
                    <TableCell>{chegada ? textoMedicao(chegada) : "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">{chegada ? textoLeituras(chegada) : "—"}</TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">
                      {chegada ? `${formatarNumero(chegada.totalDescarregado)} ${unidadeDescarga(chegada)}`.trim() : "—"}
                    </TableCell>
                  </TableRow>
                )
              })}
              {totaisDescarga.size > 0 && (
                <TableRow className="bg-muted/50 font-semibold">
                  <TableCell colSpan={7}>Total descarregado</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {[...totaisDescarga].map(([unidade, total]) => (
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
          {viagem.despesas.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma despesa lançada.</p>
          ) : (
            <ul className="divide-y rounded-lg border text-sm">
              {viagem.despesas.map((d) => (
                <li key={d.id} className="flex justify-between px-3 py-2">
                  <span>{d.tipo === "PEDAGIO" ? "Pedágio" : "Pernoite"} <span className="text-xs text-muted-foreground">{quando(d.registradoEm)}</span></span>
                  <span className="tabular-nums">{formatarReais(d.valorCentavos)}</span>
                </li>
              ))}
            </ul>
          )}
          <dl className="grid grid-cols-3 gap-2 text-sm">
            <Dado rotulo="Pedágio"><span className="tabular-nums">{formatarReais(somaDespesa("PEDAGIO"))}</span></Dado>
            <Dado rotulo="Pernoite"><span className="tabular-nums">{formatarReais(somaDespesa("PERNOITE"))}</span></Dado>
            <Dado rotulo="Total"><span className="tabular-nums">{formatarReais(somaDespesa("PEDAGIO") + somaDespesa("PERNOITE"))}</span></Dado>
          </dl>
        </Secao>

        <div className="space-y-5">
          <Secao titulo="Troca de motorista" icone={Repeat}>
            {viagem.trocas.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sem troca de motorista.</p>
            ) : (
              <ol className="divide-y rounded-lg border text-sm">
                {viagem.trocas.map((t) => (
                  <li key={t.id} className="space-y-0.5 px-3 py-2">
                    <p className="font-medium">{nome(t.motoristaAnterior.nome)} → {nome(t.motoristaNovo.nome)}</p>
                    <p className="text-xs text-muted-foreground">{quando(t.trocadoEm)} · km {km(t.km)} · {t.local}</p>
                    <p className="text-xs">Motivo: {t.motivo}</p>
                  </li>
                ))}
              </ol>
            )}
          </Secao>
          <Secao titulo="Problema mecânico" icone={Wrench}>
            {viagem.problemaMecanico ? (
              <p className="text-sm">
                <span className="font-medium text-destructive">{viagem.problemaMecanico}</span>
                <span className="block text-xs text-muted-foreground">Informado em {quando(viagem.problemaMecanicoEm)}</span>
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">Nenhum problema informado.</p>
            )}
          </Secao>
        </div>
      </div>

      <Secao titulo="Linha do tempo" icone={Clock}>
        {linhaDoTempo.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nada registrado ainda.</p>
        ) : (
          <ol className="relative space-y-3 border-l pl-5">
            {linhaDoTempo.map((evento, indice) => (
              <li key={indice} className="relative">
                <span aria-hidden className={cn("absolute -left-[25px] top-1.5 size-2.5 rounded-full ring-4 ring-card", COR_EVENTO[evento.tipo])} />
                <p className="text-xs tabular-nums text-muted-foreground">
                  {quando(evento.quando)}
                  {evento.quem && ` · ${nome(evento.quem)}`}
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
