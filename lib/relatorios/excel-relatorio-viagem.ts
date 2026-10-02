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

/** As abas do Excel do "Relatório da viagem" — o mesmo conteúdo da tela, no padrão dos outros relatórios. */
export function abasRelatorioViagem(r: RelatorioViagem): AbaPronta[] {
  const titulo = (parte: string) => `Viagem ${r.numViagem} · ${parte}`
  const subtitulo = `${formatarStatusViagem(r.status)} · ${r.motorista ?? "sem motorista"} · ${frota(r.cavalo)} / ${frota(r.carreta)}`
  const totalDescarga = r.totaisDescarga.map(({ unidade, total }) => `${formatarNumero(total)} ${unidade}`.trim()).join(" + ") || "—"

  type Campo = { campo: string; valor: string }
  const resumo: Campo[] = [
    { campo: r.teveTroca ? "Motorista (atual)" : "Motorista", valor: r.motorista ?? "—" },
    { campo: "Acompanhante", valor: r.acompanhante ?? "—" },
    { campo: "Frota (cavalo / carreta)", valor: `${frota(r.cavalo)} / ${frota(r.carreta)}` },
    { campo: "Produto", valor: r.produto ?? "—" },
    { campo: "Status", valor: formatarStatusViagem(r.status) },
    { campo: "Início previsto", valor: dataHora(r.inicioPrevisto) },
    { campo: "Fim previsto", valor: dataHora(r.fimPrevisto) },
    { campo: "Saída real", valor: dataHora(r.saidaReal) },
    { campo: "Atraso na saída", valor: r.atrasoMinutos ? `${formatarDuracao(r.atrasoMinutos)}${r.motivoAtraso ? ` · ${r.motivoAtraso}` : ""}` : "—" },
    { campo: r.encerramento.rotulo, valor: dataHora(r.encerramento.quando) },
    { campo: "Km inicial", valor: r.kmInicial?.toLocaleString("pt-BR") ?? "—" },
    { campo: "Km final", valor: r.kmFinal?.toLocaleString("pt-BR") ?? "—" },
    { campo: "Km rodado", valor: r.kmRodado === null ? "—" : `${r.kmRodado.toLocaleString("pt-BR")} km` },
    { campo: "Total descarregado", valor: totalDescarga },
    { campo: "Pedágio", valor: formatarReais(r.pedagioCentavos) },
    { campo: "Pernoite", valor: formatarReais(r.pernoiteCentavos) },
    { campo: "Despesas (total)", valor: formatarReais(r.pedagioCentavos + r.pernoiteCentavos) },
    { campo: "Trocas de motorista", valor: String(r.trocas.length) },
    { campo: "Problema mecânico", valor: r.problemaMecanico ? `${r.problemaMecanico} (${dataHora(r.problemaMecanicoEm)})` : "—" },
  ]

  return [
    aba<Campo>({
      nome: "Resumo",
      titulo: titulo("Resumo"),
      subtitulo,
      linhas: resumo,
      colunas: [
        { titulo: "Campo", valor: (l) => l.campo, tipo: "texto", largura: 26 },
        { titulo: "Valor", valor: (l) => l.valor, tipo: "texto", largura: 60 },
      ],
      orientacao: "portrait",
    }),
    aba<RelatorioViagem["entregas"][number]>({
      nome: "Entregas e chegadas",
      titulo: titulo("Entregas e chegadas"),
      subtitulo,
      resumo: [
        { rotulo: "Entregas", valor: r.entregas.length },
        { rotulo: "Chegadas registradas", valor: r.entregas.filter((e) => e.chegada).length },
        { rotulo: "Total descarregado", valor: totalDescarga },
      ],
      linhas: r.entregas,
      vazio: "Viagem sem entregas.",
      colunas: [
        { titulo: "#", valor: (e) => e.ordem, largura: 4 },
        { titulo: "Cliente", valor: (e) => e.cliente, tipo: "texto" },
        { titulo: "Cidade", valor: (e) => e.cidade, tipo: "texto" },
        { titulo: "Entrega prevista", valor: (e) => e.prevista, tipo: "dataHora" },
        { titulo: "Chegada", valor: (e) => e.chegada?.quando ?? "não registrada", tipo: "dataHora" },
        { titulo: "Km", valor: (e) => e.chegada?.km ?? null },
        { titulo: "Medição", valor: (e) => e.chegada?.medicao ?? "", tipo: "texto" },
        { titulo: "Nível inicial → final", valor: (e) => e.chegada?.leituras ?? "", tipo: "texto" },
        { titulo: "Descarregado", valor: (e) => e.chegada?.total ?? null, tipo: "decimal" },
        { titulo: "Unidade", valor: (e) => e.chegada?.unidade ?? "", tipo: "texto", largura: 8 },
      ],
    }),
    aba<RelatorioViagem["despesas"][number]>({
      nome: "Despesas",
      titulo: titulo("Despesas"),
      subtitulo,
      resumo: [
        { rotulo: "Pedágio", valor: formatarReais(r.pedagioCentavos) },
        { rotulo: "Pernoite", valor: formatarReais(r.pernoiteCentavos) },
      ],
      linhas: r.despesas,
      vazio: "Nenhuma despesa lançada.",
      colunas: [
        { titulo: "Tipo", valor: (d) => d.tipo, tipo: "texto" },
        { titulo: "Lançado em", valor: (d) => d.quando, tipo: "dataHora" },
        { titulo: "Valor (R$)", valor: (d) => d.centavos / 100, tipo: "decimal", somar: true },
      ],
      orientacao: "portrait",
    }),
    aba<RelatorioViagem["trocas"][number]>({
      nome: "Trocas de motorista",
      titulo: titulo("Trocas de motorista"),
      subtitulo,
      linhas: r.trocas,
      vazio: "Sem troca de motorista.",
      colunas: [
        { titulo: "Saiu", valor: (t) => t.de, tipo: "texto" },
        { titulo: "Assumiu", valor: (t) => t.para, tipo: "texto" },
        { titulo: "Data e hora", valor: (t) => t.quando, tipo: "dataHora" },
        { titulo: "Km", valor: (t) => t.km },
        { titulo: "Local", valor: (t) => t.local, tipo: "texto" },
        { titulo: "Motivo", valor: (t) => t.motivo, tipo: "texto" },
      ],
    }),
    aba<RelatorioViagem["linhaDoTempo"][number]>({
      nome: "Linha do tempo",
      titulo: titulo("Linha do tempo"),
      subtitulo,
      linhas: r.linhaDoTempo,
      vazio: "Nada registrado ainda.",
      colunas: [
        { titulo: "Data e hora", valor: (e) => e.quando, tipo: "dataHora" },
        { titulo: "Evento", valor: (e) => e.titulo, tipo: "texto" },
        { titulo: "Detalhe", valor: (e) => e.detalhe ?? "", tipo: "texto", largura: 50 },
        { titulo: "Quem", valor: (e) => e.quem ?? "", tipo: "texto" },
      ],
    }),
  ]
}
