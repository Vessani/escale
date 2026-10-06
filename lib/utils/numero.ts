/** "152.780" — km com separador de milhar; "—" quando não lançado. */
export function formatarKm(valor: number | null | undefined): string {
  return valor === null || valor === undefined ? "—" : valor.toLocaleString("pt-BR")
}
