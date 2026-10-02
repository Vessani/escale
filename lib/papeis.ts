/**
 * Papéis de usuário e a área do motorista — sem dependências (usado no
 * proxy, no servidor e no navegador).
 *
 * - SUPERADMIN: gerencia filiais/usuários, sem tela operacional.
 * - ADMIN / DESPACHANTE: operação da filial.
 * - MOTORISTA: só a área "Minhas viagens", com as viagens dele (login
 *   SEVA + PIN). Bloqueado em todas as outras telas, rotas e ações.
 */
/** Quem opera a escala (cria, aloca, troca motorista, gera acesso do motorista). */
export const PAPEIS_ESCALADOR = ["ADMIN", "DESPACHANTE"]

/**
 * Gerência (hoje o Admin): além de operar, vê o que foi alterado — aba
 * Histórico, histórico nas telas de edição e a linha do tempo do relatório
 * da viagem. Despachante e motorista não veem.
 */
export const PAPEIS_GERENCIA = ["ADMIN"]

export function ehGerencia(role: string | null | undefined): boolean {
  return !!role && PAPEIS_GERENCIA.includes(role)
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
