/**
 * Valores em reais guardados em centavos (inteiro) — sem erro de
 * arredondamento de float. Sem dependências (usado no navegador também).
 */

/** "R$ 1.234,50" a partir de centavos. */
export function formatarReais(centavos: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(centavos / 100)
}

/**
 * Lê o que a pessoa digitou ("12", "12,5", "12,50", "1.234,50", "R$ 8,90")
 * e devolve centavos, ou null se não for um valor válido.
 */
export function parseReaisParaCentavos(texto: string): number | null {
  const limpo = texto.replace(/[R$\s]/g, "")
  if (!/^\d{1,3}(\.\d{3})*(,\d{1,2})?$|^\d+(,\d{1,2})?$|^\d+\.\d{1,2}$/.test(limpo)) return null
  // "12.50" (ponto como decimal, comum no celular) vs "1.234" (milhar).
  const decimalComPonto = /^\d+\.\d{1,2}$/.test(limpo)
  const normalizado = decimalComPonto ? limpo : limpo.replace(/\./g, "").replace(",", ".")
  const valor = Math.round(Number(normalizado) * 100)
  return Number.isFinite(valor) ? valor : null
}

/** Como em formatarReais, mas "—" para zero (célula de relatório sem lançamento). */
export function formatarReaisOuTraco(centavos: number): string {
  return centavos ? formatarReais(centavos) : "—"
}

/** "12,50" — valor pra preencher um campo de edição (o inverso de parseReaisParaCentavos). */
export function reaisNoCampo(centavos: number): string {
  return (centavos / 100).toFixed(2).replace(".", ",")
}
