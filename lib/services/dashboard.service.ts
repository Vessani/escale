import type { StatusViagem } from "@prisma/client"
import type { FiltroStatusViagem } from "./viagem-status.service"

/**
 * No Dashboard (painel de acompanhamento) só se muda o status do ciclo da
 * viagem em andamento — criar/alocar/editar fica na Gestão de Viagens.
 * Criada/Alocada saem sozinhas da alocação, não por escolha aqui.
 */
export const STATUS_ALTERAVEIS_NO_DASHBOARD = [
  "INICIADA",
  "RETORNANDO",
  "POSTERGADA",
  "FINALIZADA",
  "CANCELADA",
] as const satisfies readonly StatusViagem[]

const STATUS_ENCERRADOS: readonly StatusViagem[] = ["FINALIZADA", "CANCELADA"]

export function viagemEncerrada(status: StatusViagem): boolean {
  return STATUS_ENCERRADOS.includes(status)
}

/**
 * Organiza as viagens do dia pro painel: contagem por status (sempre sobre
 * o dia inteiro, independente do filtro — os números dos botões não somem
 * mais ao filtrar), aplica o filtro e manda as encerradas (finalizadas e
 * canceladas) pro fim da lista, pra que o que ainda está acontecendo fique
 * em cima.
 */
export function organizarViagensDoDashboard<T extends { status: StatusViagem; inicioPrevisto: Date | string }>(
  viagens: T[],
  filtro: FiltroStatusViagem,
) {
  const contagem = {} as Record<StatusViagem, number>
  for (const viagem of viagens) {
    contagem[viagem.status] = (contagem[viagem.status] ?? 0) + 1
  }

  const visiveis = viagens
    .filter((viagem) => filtro === "TODOS" || viagem.status === filtro)
    .sort((a, b) => {
      const encerradaA = viagemEncerrada(a.status) ? 1 : 0
      const encerradaB = viagemEncerrada(b.status) ? 1 : 0
      return encerradaA - encerradaB || new Date(a.inicioPrevisto).getTime() - new Date(b.inicioPrevisto).getTime()
    })

  return { visiveis, contagem, total: viagens.length }
}
