/**
 * Entrega de cliente de verdade = linha com SAP code E número white.
 * A planilha também traz a origem/base (Joinville) e anotações, sem esses
 * códigos — elas ficam na viagem (edição do escalador), mas não contam como
 * entrega em relatórios, dashboard nem na área do motorista.
 */

type ComCodigos = { sapcode?: string | null; codewhite?: string | null }

/** Código preenchido de verdade (não vazio, nem só zeros/traços). */
function codigoPreenchido(codigo: string | null | undefined): boolean {
  return /[1-9a-z]/i.test(codigo ?? "")
}

export function ehEntregaDeCliente(entrega: ComCodigos): boolean {
  return codigoPreenchido(entrega.sapcode) && codigoPreenchido(entrega.codewhite)
}

export function soEntregasDeCliente<T extends ComCodigos>(entregas: readonly T[]): T[] {
  return entregas.filter(ehEntregaDeCliente)
}
