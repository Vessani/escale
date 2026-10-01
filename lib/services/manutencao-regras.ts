import type { NivelPreventiva, ResponsavelManutencao, TipoManutencao, VeiculoManutencao } from "@prisma/client"
import { formatarDataHoraPtBr } from "@/lib/utils/date-format"

/**
 * Regras puras da manutenção de frota (sem banco — usadas também em tela do
 * navegador). Uma manutenção é de UM veículo (cavalo ou carreta); o
 * conjunto está indisponível se qualquer um dos dois estiver parado.
 */

export type ManutencaoBase = {
  id: number
  veiculo: VeiculoManutencao
  codigo: string
  tipo: TipoManutencao
  nivel: NivelPreventiva | null
  responsavel: ResponsavelManutencao
  descricao?: string | null
  inicioPrevisto: Date | string
  fimPrevisto: Date | string | null
  inicioReal: Date | string | null
  fimReal: Date | string | null
}

export type SituacaoManutencao = "AGENDADA" | "EM_ANDAMENTO" | "ATRASADA" | "CONCLUIDA"

export const ROTULO_VEICULO: Record<VeiculoManutencao, string> = { CAVALO: "Cavalo", CARRETA: "Carreta" }
export const ROTULO_RESPONSAVEL: Record<ResponsavelManutencao, string> = { WHITE_MARTINS: "White Martins", RITMO: "Ritmo" }
export const ROTULO_TIPO: Record<TipoManutencao, string> = { PREVENTIVA: "Preventiva", CORRETIVA: "Corretiva" }
export const ROTULO_SITUACAO: Record<SituacaoManutencao, string> = {
  AGENDADA: "Agendada",
  EM_ANDAMENTO: "Em andamento",
  ATRASADA: "Passou da previsão",
  CONCLUIDA: "Concluída",
}

const data = (valor: Date | string) => new Date(valor)

/** "Preventiva B", "Corretiva". */
export function descreverTipo(manutencao: Pick<ManutencaoBase, "tipo" | "nivel">): string {
  return manutencao.tipo === "PREVENTIVA" && manutencao.nivel ? `Preventiva ${manutencao.nivel}` : ROTULO_TIPO[manutencao.tipo]
}

/** Quando de fato começou: o início real, ou o previsto se ninguém registrou. */
export function inicioEfetivo(manutencao: ManutencaoBase): Date {
  return data(manutencao.inicioReal ?? manutencao.inicioPrevisto)
}

/**
 * Até quando o veículo fica (ou ficou) parado, visto de `agora`:
 * - concluída: o fim real;
 * - em aberto: o fim previsto, mas nunca antes de `agora` — passou da
 *   previsão sem concluir, continua parado até alguém concluir;
 * - sem previsão de fim e em aberto: null (parado por tempo indeterminado).
 */
export function fimEfetivo(manutencao: ManutencaoBase, agora: Date): Date | null {
  if (manutencao.fimReal) return data(manutencao.fimReal)
  if (!manutencao.fimPrevisto) return null
  const previsto = data(manutencao.fimPrevisto)
  return inicioEfetivo(manutencao) <= agora && previsto < agora ? agora : previsto
}

export function situacaoManutencao(manutencao: ManutencaoBase, agora: Date): SituacaoManutencao {
  if (manutencao.fimReal) return "CONCLUIDA"
  if (inicioEfetivo(manutencao) > agora) return "AGENDADA"
  if (manutencao.fimPrevisto && data(manutencao.fimPrevisto) < agora) return "ATRASADA"
  return "EM_ANDAMENTO"
}

/** true se o veículo está parado em algum momento de [inicio, fim). */
export function manutencaoSobrepoe(manutencao: ManutencaoBase, inicio: Date, fim: Date, agora: Date): boolean {
  const fimManutencao = fimEfetivo(manutencao, agora)
  return inicioEfetivo(manutencao) < fim && (fimManutencao === null || fimManutencao > inicio)
}

function textoPeriodo(manutencao: ManutencaoBase, agora: Date): string {
  const fim = fimEfetivo(manutencao, agora)
  const inicio = formatarDataHoraPtBr(inicioEfetivo(manutencao))
  if (!fim) return `desde ${inicio}, sem previsão de fim`
  if (situacaoManutencao(manutencao, agora) === "ATRASADA") return `desde ${inicio}, passou da previsão e ainda não foi concluída`
  return `de ${inicio} a ${formatarDataHoraPtBr(fim)}`
}

/**
 * Aviso da viagem que usa um cavalo ou carreta em manutenção no período
 * dela (null se nenhum). Só avisa, não bloqueia — mesmo espírito do aviso
 * de frota indisponível.
 */
export function avisoManutencaoNaViagem(
  manutencoes: ManutencaoBase[],
  cavalo: string,
  carreta: string,
  inicio: Date,
  fim: Date,
  agora: Date,
): string | null {
  const conflito = manutencoes
    .filter((manutencao) => !manutencao.fimReal || data(manutencao.fimReal) > inicio)
    .filter(
      (manutencao) =>
        (manutencao.veiculo === "CAVALO" && manutencao.codigo === cavalo) ||
        (manutencao.veiculo === "CARRETA" && manutencao.codigo === carreta),
    )
    .filter((manutencao) => manutencaoSobrepoe(manutencao, inicio, fim, agora))
    .sort((a, b) => inicioEfetivo(a).getTime() - inicioEfetivo(b).getTime())[0]

  if (!conflito) return null
  return `${ROTULO_VEICULO[conflito.veiculo]} ${conflito.codigo} em manutenção (${descreverTipo(conflito)}, ${ROTULO_RESPONSAVEL[conflito.responsavel]}) ${textoPeriodo(conflito, agora)}.`
}

/** Manutenção atual (parado agora) do veículo, ou a próxima agendada. */
export function manutencaoAtualOuProxima(
  manutencoes: ManutencaoBase[],
  veiculo: VeiculoManutencao,
  codigo: string,
  agora: Date,
): { atual: ManutencaoBase | null; proxima: ManutencaoBase | null } {
  const doVeiculo = manutencoes.filter((m) => m.veiculo === veiculo && m.codigo === codigo && !m.fimReal)
  const atual =
    doVeiculo
      .filter((m) => situacaoManutencao(m, agora) !== "AGENDADA")
      .sort((a, b) => inicioEfetivo(a).getTime() - inicioEfetivo(b).getTime())[0] ?? null
  const proxima =
    doVeiculo
      .filter((m) => situacaoManutencao(m, agora) === "AGENDADA")
      .sort((a, b) => inicioEfetivo(a).getTime() - inicioEfetivo(b).getTime())[0] ?? null
  return { atual, proxima }
}
