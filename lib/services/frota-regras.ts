/**
 * Regras puras de frota, sem acesso a banco — extraídas de frota.service.ts
 * pra poderem ser reaproveitadas também no cliente (ex: detectar conflito
 * entre viagens de um mesmo lote ainda não salvo, antes de existirem no
 * banco). Um módulo que importa @/lib/prisma não pode ser importado por um
 * componente "use client" (traria Pool/pg pro bundle do navegador).
 */

/** Valor usado pela planilha (ver xlsx-parser.ts) quando um veículo truck não tem cavalo separado — não representa uma frota real. */
const CODIGO_FROTA_PLACEHOLDER = "0000"

export function frotaEhValida(codigo: string): boolean {
  return codigo.trim().length > 0 && codigo !== CODIGO_FROTA_PLACEHOLDER
}

/** true se as duas viagens compartilham cavalo ou carreta (códigos inválidos/placeholder nunca contam como coincidência). */
export function viagensCompartilhamFrota(cavaloA: string, carretaA: string, cavaloB: string, carretaB: string): boolean {
  const codigosB = new Set([cavaloB, carretaB].filter(frotaEhValida))
  return [cavaloA, carretaA].filter(frotaEhValida).some((codigo) => codigosB.has(codigo))
}

export type StatusFrota = "DISPONIVEL" | "MANUTENCAO"

/** disponivelEm nulo ou no passado = disponível agora; no futuro = em manutenção/ocupado até lá. */
export function calcularStatusFrota(disponivelEm: Date | string | null, agora: Date): StatusFrota {
  if (!disponivelEm) {
    return "DISPONIVEL"
  }

  return new Date(disponivelEm) > agora ? "MANUTENCAO" : "DISPONIVEL"
}
