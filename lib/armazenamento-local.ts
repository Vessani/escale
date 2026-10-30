/**
 * localStorage do navegador sem quebrar a tela: ele pode não existir (no
 * servidor) ou lançar (aba anônima, armazenamento bloqueado ou cheio). Tudo
 * que o sistema guarda no navegador é um extra — lembrar o nome do gestor, a
 * sidebar colapsada, o rascunho da chegada —, então falhar aqui só deixa de
 * lembrar, nunca derruba a página.
 */

export type Armazenamento = Pick<Storage, "getItem" | "setItem" | "removeItem">

export function armazenamentoLocal(): Armazenamento | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage
  } catch {
    return null
  }
}

export function lerLocal(chave: string, armazenamento: Armazenamento | null = armazenamentoLocal()): string | null {
  try {
    return armazenamento?.getItem(chave) ?? null
  } catch {
    return null
  }
}

export function gravarLocal(chave: string, valor: string, armazenamento: Armazenamento | null = armazenamentoLocal()) {
  try {
    armazenamento?.setItem(chave, valor)
  } catch {
    // Sem espaço ou bloqueado: só não lembra.
  }
}

export function apagarLocal(chave: string, armazenamento: Armazenamento | null = armazenamentoLocal()) {
  try {
    armazenamento?.removeItem(chave)
  } catch {
    // idem
  }
}
