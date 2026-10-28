"use client"

import { createContext, useContext, type ReactNode } from "react"

/**
 * Liga o modo só consulta (a torre) nos componentes de cliente que gravam
 * algo — status rápido, saída real, recado do quadro, excluir... Esconder o
 * controle é só pra tela: quem barra de verdade é o servidor (auth-guard.ts).
 */
const SomenteLeituraContext = createContext(false)

export function SomenteLeituraProvider({ ativo, children }: { ativo: boolean; children: ReactNode }) {
  return <SomenteLeituraContext.Provider value={ativo}>{children}</SomenteLeituraContext.Provider>
}

export function useSomenteLeitura() {
  return useContext(SomenteLeituraContext)
}

/** Mostra o conteúdo (botão "Nova", link "Editar"...) só pra quem opera — some na torre. */
export function SoQuemOpera({ children }: { children: ReactNode }) {
  return useSomenteLeitura() ? null : children
}

/** O contrário de SoQuemOpera: o caminho só leitura que a torre usa no lugar (ex: relatório em vez de editar). */
export function SoNaTorre({ children }: { children: ReactNode }) {
  return useSomenteLeitura() ? children : null
}
