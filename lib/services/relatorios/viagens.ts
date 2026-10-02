import type { StatusViagem } from "@prisma/client"
import { formatarProduto } from "@/lib/services/produto.service"
import { linhaKmCustos, type ViagemKmCustos } from "@/lib/services/relatorios/km-custos"

/**
 * Relatório "Viagens": uma linha por viagem, de todas as viagens do período
 * (menos canceladas) — nº, motorista, produto, cidades, km e despesas. As
 * que ainda não saíram aparecem com km e custos vazios.
 */

export const STATUS_RELATORIO_VIAGENS: StatusViagem[] = ["CRIADA", "ALOCADA", "POSTERGADA", "INICIADA", "RETORNANDO", "FINALIZADA"]

export function relatorioViagens(viagens: ViagemKmCustos[]) {
  const linhas = viagens
    .map((viagem) => ({ ...linhaKmCustos(viagem), produto: viagem.produto ? formatarProduto(viagem.produto) : null }))
    .sort((a, b) => a.inicio.getTime() - b.inicio.getTime() || a.numViagem.localeCompare(b.numViagem))
  const soma = (campo: (linha: (typeof linhas)[number]) => number) => linhas.reduce((total, linha) => total + campo(linha), 0)

  return {
    linhas,
    totais: {
      viagens: linhas.length,
      viagensComKm: linhas.filter((linha) => linha.kmRodado !== null).length,
      kmRodado: soma((linha) => linha.kmRodado ?? 0),
      pedagioCentavos: soma((linha) => linha.pedagioCentavos),
      pernoiteCentavos: soma((linha) => linha.pernoiteCentavos),
    },
  }
}
