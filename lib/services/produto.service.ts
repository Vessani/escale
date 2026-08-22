import type { TipoProduto } from "@prisma/client"

export const PRODUTO_VALORES = [
  "CO2",
  "NITROGENIO",
  "ARGONIO",
  "BIOMETANO",
  "OXIGENIO",
] as const satisfies readonly TipoProduto[]

const PRODUTO_LABELS: Record<TipoProduto, string> = {
  CO2: "Carbono",
  NITROGENIO: "Nitrogênio",
  ARGONIO: "Argônio",
  BIOMETANO: "Biometano",
  OXIGENIO: "Oxigênio",
}

export const PRODUTO_OPCOES: Array<{ valor: TipoProduto; label: string }> = PRODUTO_VALORES.map((valor) => ({
  valor,
  label: PRODUTO_LABELS[valor],
}))

export function ehTipoProduto(valor: string): valor is TipoProduto {
  return PRODUTO_VALORES.some((item) => item === valor)
}

export function formatarProduto(produto: TipoProduto | null | undefined): string {
  return produto ? PRODUTO_LABELS[produto] : "Não informado"
}
