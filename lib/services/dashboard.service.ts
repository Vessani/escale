import type { StatusViagem, Turno } from "@prisma/client"

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

/** O que ainda está acontecendo (vai sair, saiu, voltando, adiada) — é o que aparece na lista do painel. */
export const STATUS_ATIVOS_DASHBOARD = [
  "CRIADA",
  "ALOCADA",
  "INICIADA",
  "RETORNANDO",
  "POSTERGADA",
] as const satisfies readonly StatusViagem[]

/** Encerradas do dia: só contador, não ocupam a lista. */
export const STATUS_ENCERRADOS_DASHBOARD = ["FINALIZADA", "CANCELADA"] as const satisfies readonly StatusViagem[]

export function viagemEncerrada(status: StatusViagem): boolean {
  return (STATUS_ENCERRADOS_DASHBOARD as readonly StatusViagem[]).includes(status)
}

/**
 * Organiza as viagens do dia pro painel: contagem por status (dia inteiro,
 * encerradas inclusive) e a lista só com as ativas, em ordem de início.
 */
export function organizarViagensDoDashboard<T extends { status: StatusViagem; inicioPrevisto: Date | string }>(viagens: T[]) {
  const contagem = {} as Record<StatusViagem, number>
  for (const viagem of viagens) {
    contagem[viagem.status] = (contagem[viagem.status] ?? 0) + 1
  }

  const ativas = viagens
    .filter((viagem) => !viagemEncerrada(viagem.status))
    .sort((a, b) => new Date(a.inicioPrevisto).getTime() - new Date(b.inicioPrevisto).getTime())

  return { ativas, contagem }
}

type ResumoTurno = { viagens: number; entregas: number }

/**
 * Programação do dia por turno: viagens que começam no dia (as canceladas
 * não contam; Retornando de dias anteriores também não — é de outro dia) e
 * quantas entregas cada turno tem. Turno = o da viagem (Dia até 15:59,
 * Noite a partir das 16:00, mesma regra da importação e da alocação).
 */
export function resumoPorTurno<T extends { status: StatusViagem; turno: Turno; inicioPrevisto: Date | string; entregas: unknown[] }>(
  viagens: T[],
  inicioDia: Date,
  fimDia: Date,
) {
  const resumo: Record<Turno, ResumoTurno> = { MANHA: { viagens: 0, entregas: 0 }, NOITE: { viagens: 0, entregas: 0 } }
  for (const viagem of viagens) {
    const inicio = new Date(viagem.inicioPrevisto).getTime()
    if (viagem.status === "CANCELADA" || inicio < inicioDia.getTime() || inicio > fimDia.getTime()) continue
    resumo[viagem.turno].viagens += 1
    resumo[viagem.turno].entregas += viagem.entregas.length
  }
  return {
    dia: resumo.MANHA,
    noite: resumo.NOITE,
    total: { viagens: resumo.MANHA.viagens + resumo.NOITE.viagens, entregas: resumo.MANHA.entregas + resumo.NOITE.entregas },
  }
}
