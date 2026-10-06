import { aba, type AbaPronta } from "@/lib/excel/planilha"
import { formatarNumero } from "@/lib/services/descarga"
import { formatarStatusViagem } from "@/lib/services/viagem-status.service"
import { formatarCodigoFrota } from "@/lib/services/frota-regras"
import { formatarDuracao } from "@/lib/relatorios/formato"
import { formatarReais } from "@/lib/utils/dinheiro"
import { formatarDataHoraPtBr } from "@/lib/utils/date-format"
import type { RelatorioViagem } from "./relatorio-viagem"

const dataHora = (data: Date | null | undefined) => (data ? formatarDataHoraPtBr(data) : "—")
const frota = (codigo: string | null) => (codigo ? formatarCodigoFrota(codigo).replace("—", "") : "")

/** Uma linha da planilha: as seções usam as mesmas colunas (compacto, numa aba só). */
type Linha = {
  secao: string
  quando: Date | null
  item: string
  detalhe: string
  km: number | null
  descarregado: number | null
  valor: number | null
}

const linha = (secao: string, parcial: Partial<Linha> & Pick<Linha, "item">): Linha => ({
  secao,
  quando: null,
  detalhe: "",
  km: null,
  descarregado: null,
  valor: null,
  ...parcial,
})

/**
 * O "Relatório da viagem" numa aba só, organizada em seções (Resumo,
 * Entregas e chegadas, Despesas, Trocas, Linha do tempo) com as mesmas
 * colunas. Os totais vão no cabeçalho (km, descarregado, pedágio + pernoite).
 */
export function abasRelatorioViagem(r: RelatorioViagem): AbaPronta[] {
  const totalDescarga = r.totaisDescarga.map(({ unidade, total }) => `${formatarNumero(total)} ${unidade}`.trim()).join(" + ") || "—"
  const RESUMO = "Resumo"
  const ENTREGAS = `Entregas e chegadas (${r.entregas.filter((e) => e.chegada).length} de ${r.entregas.length} registradas)`
  const DESPESAS = "Despesas"
  const TROCAS = "Trocas de motorista"
  const TEMPO = "Linha do tempo"

  const linhas: Linha[] = [
    linha(RESUMO, {
      item: r.teveTroca ? "Motorista (atual)" : "Motorista",
      detalhe: [r.motorista ?? "—", r.acompanhante && `acompanhante: ${r.acompanhante}`].filter(Boolean).join(" · "),
    }),
    linha(RESUMO, { item: "Frota e produto", detalhe: `${frota(r.cavalo)} / ${frota(r.carreta)} · ${r.produto ?? "sem produto"}` }),
    linha(RESUMO, { item: "Previsto", detalhe: `${dataHora(r.inicioPrevisto)} até ${dataHora(r.fimPrevisto)}` }),
    linha(RESUMO, {
      item: "Saída real",
      quando: r.saidaReal,
      detalhe: r.atrasoMinutos
        ? `atraso de ${formatarDuracao(r.atrasoMinutos)}${r.motivoAtraso ? ` · ${r.motivoAtraso}` : ""}`
        : r.saidaReal
          ? "no horário"
          : "—",
    }),
    linha(RESUMO, { item: r.encerramento.rotulo, quando: r.encerramento.quando, detalhe: r.encerramento.quando ? "" : "—" }),
    linha(RESUMO, {
      item: "Km",
      detalhe: `inicial ${r.kmInicial?.toLocaleString("pt-BR") ?? "—"} · final ${r.kmFinal?.toLocaleString("pt-BR") ?? "—"} · rodado ${r.kmRodado === null ? "—" : `${r.kmRodado.toLocaleString("pt-BR")} km`}`,
    }),
    linha(RESUMO, { item: "Total descarregado", detalhe: totalDescarga }),
    linha(RESUMO, { item: "Problema mecânico", quando: r.problemaMecanicoEm, detalhe: r.problemaMecanico ?? "nenhum" }),

    ...r.entregas.map((e) =>
      linha(ENTREGAS, {
        quando: e.chegada?.quando ?? null,
        item: `${e.ordem}. ${e.cliente} (${e.cidade})`,
        detalhe: e.chegada
          ? `${e.chegada.medicao} · ${e.chegada.leituras}${e.chegada.unidade ? ` · ${e.chegada.unidade}` : ""}`
          : `chegada não registrada · previsto ${dataHora(e.prevista)}`,
        km: e.chegada?.km ?? null,
        descarregado: e.chegada?.total ?? null,
      }),
    ),

    ...(r.despesas.length
      ? r.despesas.map((d) => linha(DESPESAS, { quando: d.quando, item: d.tipo, valor: d.centavos / 100 }))
      : [linha(DESPESAS, { item: "Nenhuma despesa lançada" })]),

    ...(r.trocas.length
      ? r.trocas.map((t) => linha(TROCAS, { quando: t.quando, item: `${t.de} → ${t.para}`, detalhe: `${t.local} · ${t.motivo}`, km: t.km }))
      : [linha(TROCAS, { item: "Sem troca de motorista" })]),

    ...(r.linhaDoTempo ?? []).map((e) =>
      linha(TEMPO, { quando: e.quando, item: e.titulo, detalhe: [e.detalhe, e.quem && `por ${e.quem}`].filter(Boolean).join(" · ") }),
    ),
  ]

  return [
    aba<Linha>({
      nome: `Viagem ${r.numViagem}`,
      titulo: `Relatório da viagem ${r.numViagem}`,
      subtitulo: `${formatarStatusViagem(r.status)} · ${r.motorista ?? "sem motorista"} · ${frota(r.cavalo)} / ${frota(r.carreta)}`,
      resumo: [
        { rotulo: "Km rodado", valor: r.kmRodado === null ? "—" : r.kmRodado.toLocaleString("pt-BR") },
        { rotulo: "Descarregado", valor: totalDescarga },
        { rotulo: "Pedágio + pernoite", valor: formatarReais(r.pedagioCentavos + r.pernoiteCentavos) },
      ],
      linhas,
      grupo: (l) => l.secao,
      colunas: [
        { titulo: "Data e hora", valor: (l) => l.quando, tipo: "dataHora" },
        { titulo: "Item", valor: (l) => l.item, tipo: "texto", largura: 34 },
        { titulo: "Detalhe", valor: (l) => l.detalhe, tipo: "texto", largura: 50 },
        { titulo: "Km", valor: (l) => l.km, tipo: "numero" },
        { titulo: "Descarregado", valor: (l) => l.descarregado, tipo: "decimal" },
        { titulo: "Valor (R$)", valor: (l) => l.valor, tipo: "decimal" },
      ],
    }),
  ]
}
