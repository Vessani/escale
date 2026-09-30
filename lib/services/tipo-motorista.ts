import type { TipoMotorista } from "@prisma/client"

/**
 * Fonte única das regras por tipo de motorista (ver enum TipoMotorista no
 * schema) — sugestão, validação ao gravar e telas perguntam aqui, em vez de
 * cada uma comparar o tipo por conta própria.
 */
export const TIPO_MOTORISTA_VALORES = [
  "MOTORISTA",
  "TREINAMENTO",
  "INSTRUTOR",
  "INTERNO",
  "ENCHEDOR",
] as const satisfies readonly TipoMotorista[]

const TIPO_MOTORISTA_LABELS: Record<TipoMotorista, string> = {
  MOTORISTA: "Motorista",
  TREINAMENTO: "Em treinamento",
  INSTRUTOR: "Instrutor",
  INTERNO: "Interno",
  ENCHEDOR: "Enchedor",
}

const TIPO_MOTORISTA_DESCRICOES: Record<TipoMotorista, string> = {
  MOTORISTA: "Faz viagem e entra na sugestão automática.",
  TREINAMENTO: "Só vai como acompanhante — nunca como motorista principal.",
  INSTRUTOR: "Acompanha outro motorista ou quem está em treinamento. Alocação só manual, fora da sugestão.",
  INTERNO: "Apoio da operação (render motorista, levar frota pra lavar). Fora da sugestão; alocação manual quando precisar.",
  ENCHEDOR: "Não faz viagem.",
}

export const TIPO_MOTORISTA_OPCOES: Array<{ valor: TipoMotorista; label: string; descricao: string }> =
  TIPO_MOTORISTA_VALORES.map((valor) => ({
    valor,
    label: TIPO_MOTORISTA_LABELS[valor],
    descricao: TIPO_MOTORISTA_DESCRICOES[valor],
  }))

export function formatarTipoMotorista(tipo: TipoMotorista): string {
  return TIPO_MOTORISTA_LABELS[tipo]
}

export function descreverTipoMotorista(tipo: TipoMotorista): string {
  return TIPO_MOTORISTA_DESCRICOES[tipo]
}

/** Só o motorista comum é sugerido automaticamente — instrutor e interno são sempre escolha manual. */
export function entraNaSugestaoAutomatica(tipo: TipoMotorista): boolean {
  return tipo === "MOTORISTA"
}

/** Quem pode ir como motorista principal (escolhido à mão, no caso de instrutor/interno). */
export function podeSerPrincipal(tipo: TipoMotorista): boolean {
  return tipo === "MOTORISTA" || tipo === "INSTRUTOR" || tipo === "INTERNO"
}

/** Quem pode ir como acompanhante — todo mundo que viaja. */
export function podeSerAcompanhante(tipo: TipoMotorista): boolean {
  return tipo !== "ENCHEDOR"
}
