import type { Turno } from "@prisma/client"
import { turnoPorHorario } from "./turno"

/** Regras puras de status e turno da viagem, usadas na criação/edição e nas mudanças de status. */

export function resolverStatusPorAlocacao(motoristaId: number | null) {
  return motoristaId === null ? "CRIADA" : "ALOCADA";
}

/**
 * Turno ao editar: se o início mudou e quem editou não mexeu no turno, ele
 * acompanha o novo horário (ver turnoPorHorario). Se o turno foi trocado à
 * mão na edição, vale o escolhido.
 */
export function turnoAposMudarHorario(
  viagemAtual: { inicioPrevisto: Date; turno: Turno },
  novoInicio: Date,
  turnoEnviado: Turno,
): Turno {
  const inicioAnterior = viagemAtual.inicioPrevisto ? new Date(viagemAtual.inicioPrevisto).getTime() : null
  const inicioMudou = inicioAnterior !== null && novoInicio.getTime() !== inicioAnterior
  if (!inicioMudou || turnoEnviado !== viagemAtual.turno) return turnoEnviado
  return turnoPorHorario(novoInicio) ?? turnoEnviado
}

export function statusPermiteAutoAjuste(statusAtual: string) {
  return statusAtual === "CRIADA" || statusAtual === "ALOCADA"
}

/**
 * CRIADA e ALOCADA não são escolha de quem cadastra: dizem só se a viagem
 * tem motorista. Qualquer gravação passa por aqui pra "Criada com motorista"
 * (ou "Alocada sem motorista") nunca existir — antes, o formulário de nova
 * viagem mandava CRIADA mesmo com motorista escolhido. Os demais status
 * (EM_ANDAMENTO, CANCELADA...) passam intactos.
 */
export function normalizarStatusPorAlocacao<S extends string>(status: S, motoristaId: number | null): S | "CRIADA" | "ALOCADA" {
  return statusPermiteAutoAjuste(status) ? resolverStatusPorAlocacao(motoristaId) : status
}

/** Marca o instante da transição para CANCELADA — usado pelo Dashboard pra decidir até quando a viagem cancelada ainda aparece. Não mexe se o status não mudou (evita renovar a janela de visibilidade a cada edição de uma viagem já cancelada). */
export function calcularCanceladoEm(statusNovo: string, statusAntigo: string): Date | undefined {
  return statusNovo === "CANCELADA" && statusAntigo !== "CANCELADA" ? new Date() : undefined
}

/**
 * Marca o instante da transição para FINALIZADA — a partir dele o motorista
 * está livre (o descanso de 11h/35h conta daqui, ver fimEfetivoViagem). Não
 * mexe se já estava finalizada; limpa se a viagem for reaberta, pra não
 * deixar uma finalização antiga valendo.
 */
export function calcularFinalizadoEm(statusNovo: string, statusAntigo: string): Date | null | undefined {
  if (statusNovo === "FINALIZADA") {
    return statusAntigo !== "FINALIZADA" ? new Date() : undefined
  }
  return statusAntigo === "FINALIZADA" ? null : undefined
}
