/**
 * Papéis de usuário e a área do motorista — sem dependências (usado no
 * proxy, no servidor e no navegador).
 *
 * - SUPERADMIN: gerencia filiais/usuários, sem tela operacional.
 * - ADMIN / DESPACHANTE: operação da filial.
 * - TORRE: central que acompanha todas as filiais, só consulta. Sem filial
 *   no cadastro: escolhe qual ver no menu (ver lib/torre.ts). Bloqueada em
 *   toda action e tela que não a libere de propósito (ver auth-guard.ts).
 * - MOTORISTA: só a área "Minhas viagens", com as viagens dele (login
 *   SEVA + PIN). Bloqueado em todas as outras telas, rotas e ações.
 */
/** Quem opera a escala (cria, aloca, troca motorista, gera acesso do motorista). */
export const PAPEIS_ESCALADOR = ["ADMIN", "DESPACHANTE"]

export const PAPEL_TORRE = "TORRE"

export function ehTorre(role: string | null | undefined): boolean {
  return role === PAPEL_TORRE
}

/** Telas de consulta (dashboard, listas, relatórios): quem opera e a torre. */
export const PAPEIS_LEITURA = [...PAPEIS_ESCALADOR, PAPEL_TORRE]

/**
 * Quem vê o que foi alterado — aba Histórico, histórico nas telas de edição
 * e a linha do tempo do relatório da viagem: o Admin e a torre. Despachante
 * e motorista não veem. Só leitura: não usar como lista de quem pode alterar.
 */
export const PAPEIS_HISTORICO = ["ADMIN", PAPEL_TORRE]

export function veHistorico(role: string | null | undefined): boolean {
  return !!role && PAPEIS_HISTORICO.includes(role)
}

export const PAPEL_MOTORISTA = "MOTORISTA"

/** Única área que o motorista acessa. */
export const AREA_MOTORISTA = "/minhas-viagens"

export function ehMotorista(role: string | null | undefined): boolean {
  return role === PAPEL_MOTORISTA
}

export function ehAreaMotorista(caminho: string): boolean {
  return caminho === AREA_MOTORISTA || caminho.startsWith(`${AREA_MOTORISTA}/`)
}
