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

/**
 * true se as duas viagens usam a mesma carreta (código inválido/placeholder
 * nunca conta como coincidência) — só a carreta importa pro cliente, o
 * cavalo é ignorado (mesmo critério de frota.service.ts).
 */
export function viagensCompartilhamFrota(carretaA: string, carretaB: string): boolean {
  return frotaEhValida(carretaA) && frotaEhValida(carretaB) && carretaA === carretaB
}

export type StatusFrota = "DISPONIVEL" | "EM_VIAGEM" | "MANUTENCAO"

/**
 * `emManutencao` é manual e sempre vence — só muda por ação explícita no
 * cadastro (ver components/frota/frota-form.tsx). Sem isso, `disponivelEm`
 * no futuro decide: reservada por uma viagem (o sistema grava isso sozinho,
 * ver registrarOuAtualizarDisponibilidadeFrota) ou já disponível.
 */
export function calcularStatusFrota(emManutencao: boolean, disponivelEm: Date | string | null, agora: Date): StatusFrota {
  if (emManutencao) {
    return "MANUTENCAO"
  }

  if (!disponivelEm) {
    return "DISPONIVEL"
  }

  return new Date(disponivelEm) > agora ? "EM_VIAGEM" : "DISPONIVEL"
}
