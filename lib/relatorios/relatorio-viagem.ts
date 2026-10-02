import type { StatusViagem } from "@prisma/client"
import { buscarRelatorioViagem } from "@/lib/queries/relatorio-viagem"
import { montarLinhaDoTempo, mudancasDeStatus } from "@/lib/services/relatorio-viagem"
import { formatarNumero, textoLeituras, textoMedicao, unidadeDescarga } from "@/lib/services/descarga"
import { formatarStatusViagem } from "@/lib/services/viagem-status.service"
import { formatarProduto } from "@/lib/services/produto.service"
import { minutosDeAtraso } from "@/lib/services/pontualidade"
import { formatarReais } from "@/lib/utils/dinheiro"
import { formatarNomeProprio } from "@/lib/utils/texto"

/**
 * Tudo do "Relatório da viagem" já calculado — a tela e o Excel usam o mesmo
 * objeto, então mostram sempre os mesmos números.
 */

const nome = (texto: string | null | undefined) => (texto ? formatarNomeProprio(texto) : null)
const rotuloDespesa = (tipo: "PEDAGIO" | "PERNOITE") => (tipo === "PEDAGIO" ? "Pedágio" : "Pernoite")

export async function carregarRelatorioViagem(filialId: number, viagemId: number) {
  const dados = await buscarRelatorioViagem(filialId, viagemId)
  if (!dados) return null
  const { viagem, historico } = dados

  const entregas = viagem.entregas.map((entrega, indice) => {
    const c = entrega.chegada
    const chegada = c && {
      medicao: c.medicao,
      fator: c.fator === null ? null : Number(c.fator),
      nivelInicial: Number(c.nivelInicial),
      nivelFinal: Number(c.nivelFinal),
      polInicial: c.polInicial === null ? null : Number(c.polInicial),
      polFinal: c.polFinal === null ? null : Number(c.polFinal),
      total: Number(c.totalDescarregado),
    }
    return {
      id: entrega.id,
      ordem: indice + 1,
      cliente: entrega.cliente,
      cidade: `${formatarNomeProprio(entrega.cidade)}/${entrega.uf}`,
      prevista: entrega.dataEntrega,
      chegada: chegada && {
        quando: c.chegadaEm,
        km: c.km,
        medicao: textoMedicao(chegada),
        leituras: textoLeituras(chegada),
        total: chegada.total,
        unidade: unidadeDescarga(chegada),
      },
    }
  })

  const totaisPorUnidade = new Map<string, number>()
  for (const { chegada } of entregas) {
    if (chegada) totaisPorUnidade.set(chegada.unidade, (totaisPorUnidade.get(chegada.unidade) ?? 0) + chegada.total)
  }

  const despesas = viagem.despesas.map((d) => ({ id: d.id, tipo: rotuloDespesa(d.tipo), quando: d.registradoEm, centavos: d.valorCentavos }))
  const pedagioCentavos = viagem.despesas.filter((d) => d.tipo === "PEDAGIO").reduce((t, d) => t + d.valorCentavos, 0)
  const pernoiteCentavos = viagem.despesas.filter((d) => d.tipo === "PERNOITE").reduce((t, d) => t + d.valorCentavos, 0)

  const trocas = viagem.trocas.map((t) => ({
    id: t.id,
    de: nome(t.motoristaAnterior.nome) ?? "",
    para: nome(t.motoristaNovo.nome) ?? "",
    quando: t.trocadoEm,
    km: t.km,
    local: t.local,
    motivo: t.motivo,
  }))

  const cancelada = viagem.status === "CANCELADA"
  const linhaDoTempo = montarLinhaDoTempo({
    rotuloStatus: (status: StatusViagem) => formatarStatusViagem(status),
    mudancasStatus: mudancasDeStatus(historico).map((mudanca) => ({ ...mudanca, quem: nome(mudanca.quem) })),
    saida: viagem.horarioRealSaida ? { quando: viagem.horarioRealSaida, km: viagem.kmInicial, motivoAtraso: viagem.motivoAtraso } : null,
    chegadas: entregas.flatMap(({ cliente, chegada }) =>
      chegada ? [{ quando: chegada.quando, cliente, km: chegada.km, total: `${formatarNumero(chegada.total)} ${chegada.unidade}`.trim() }] : [],
    ),
    despesas: despesas.map((d) => ({ quando: d.quando, tipo: d.tipo, valor: formatarReais(d.centavos) })),
    trocas,
    problema: viagem.problemaMecanico && viagem.problemaMecanicoEm ? { quando: viagem.problemaMecanicoEm, texto: viagem.problemaMecanico } : null,
    fim:
      viagem.status === "FINALIZADA" && viagem.finalizadoEm
        ? { quando: viagem.finalizadoEm, status: "FINALIZADA", km: viagem.kmFinal }
        : cancelada && viagem.canceladoEm
          ? { quando: viagem.canceladoEm, status: "CANCELADA", km: null }
          : null,
  })

  return {
    id: viagem.id,
    numViagem: viagem.numViagem,
    status: viagem.status,
    problemaMecanico: viagem.problemaMecanico,
    problemaMecanicoEm: viagem.problemaMecanicoEm,
    motorista: nome(viagem.motorista?.nome),
    teveTroca: trocas.length > 0,
    acompanhante: nome(viagem.motoristaAcompanhante?.nome),
    cavalo: viagem.cavalo,
    carreta: viagem.carreta,
    produto: viagem.produto ? formatarProduto(viagem.produto) : null,
    inicioPrevisto: viagem.inicioPrevisto,
    fimPrevisto: viagem.fimPrevisto,
    saidaReal: viagem.horarioRealSaida,
    atrasoMinutos: viagem.horarioRealSaida ? Math.max(0, minutosDeAtraso(viagem.inicioPrevisto, viagem.horarioRealSaida)) : null,
    motivoAtraso: viagem.motivoAtraso,
    encerramento: { rotulo: cancelada ? "Cancelada em" : "Encerrada em", quando: cancelada ? viagem.canceladoEm : viagem.finalizadoEm },
    kmInicial: viagem.kmInicial,
    kmFinal: viagem.kmFinal,
    kmRodado: viagem.kmInicial !== null && viagem.kmFinal !== null ? viagem.kmFinal - viagem.kmInicial : null,
    entregas,
    totaisDescarga: [...totaisPorUnidade].map(([unidade, total]) => ({ unidade, total })),
    despesas,
    pedagioCentavos,
    pernoiteCentavos,
    trocas,
    linhaDoTempo,
  }
}

export type RelatorioViagem = NonNullable<Awaited<ReturnType<typeof carregarRelatorioViagem>>>
