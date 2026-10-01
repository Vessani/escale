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

/** Código de frota pra exibir — o placeholder "0000" (truck sem cavalo separado) aparece como "—". */
export function formatarCodigoFrota(codigo: string): string {
  return frotaEhValida(codigo) ? codigo : "—"
}

/**
 * true se as duas viagens usam a mesma carreta (código inválido/placeholder
 * nunca conta como coincidência) — só a carreta importa pro cliente, o
 * cavalo é ignorado (mesmo critério de frota.service.ts).
 */
export function viagensCompartilhamFrota(carretaA: string, carretaB: string): boolean {
  return frotaEhValida(carretaA) && frotaEhValida(carretaB) && carretaA === carretaB
}

type StatusFrota = "DISPONIVEL" | "EM_VIAGEM" | "MANUTENCAO"

/**
 * Situação do conjunto: manutenção do cavalo ou da carreta em andamento
 * agora sempre vence (ver manutencaoAtualOuProxima); sem isso,
 * `disponivelEm` no futuro decide — reservada por uma viagem (o sistema
 * grava isso sozinho, ver sincronizarDisponibilidadeFrota) ou disponível.
 */
export function calcularStatusFrota(emManutencaoAgora: boolean, disponivelEm: Date | string | null, agora: Date): StatusFrota {
  if (emManutencaoAgora) {
    return "MANUTENCAO"
  }

  if (!disponivelEm) {
    return "DISPONIVEL"
  }

  return new Date(disponivelEm) > agora ? "EM_VIAGEM" : "DISPONIVEL"
}
