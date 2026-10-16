import type { TipoMotorista, TipoProduto } from "@prisma/client"
import { podeSerAcompanhante } from "./tipo-motorista"

export const PRODUTO_VALORES = ["CO2", "NITROGENIO", "ARGONIO", "BIOMETANO", "OXIGENIO", "GNL"] as const satisfies readonly TipoProduto[]

const PRODUTO_LABELS: Record<TipoProduto, string> = {
  CO2: "Carbono",
  NITROGENIO: "Nitrogênio",
  ARGONIO: "Argônio",
  BIOMETANO: "Biometano",
  OXIGENIO: "Oxigênio",
  GNL: "GNL",
}

export const PRODUTO_OPCOES: Array<{ valor: TipoProduto; label: string }> = PRODUTO_VALORES.map((valor) => ({
  valor,
  label: PRODUTO_LABELS[valor],
}))

export function ehTipoProduto(valor: string): valor is TipoProduto {
  return PRODUTO_VALORES.some((item) => item === valor)
}

/**
 * Pedaços do nome que identificam cada produto, já sem acento e em
 * minúsculas. Pedaço curto de propósito: "oxigen" pega "Oxigênio (Sul)",
 * "Oxigênio Laser" e "Oxigênio Ultra Puro" (todos usam a frota do oxigênio)
 * e tolera erro de digitação no fim da palavra.
 */
const TERMOS_DO_PRODUTO: Record<TipoProduto, string[]> = {
  OXIGENIO: ["oxigen"],
  NITROGENIO: ["nitrogen"],
  ARGONIO: ["argon"],
  CO2: ["co2", "carbono", "carbonico"],
  BIOMETANO: ["biometano"],
  GNL: ["gnl", "gas natural liquefeito"],
}

function semAcentoMinusculo(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
}

/**
 * Produto citado num texto livre, como o título da planilha de programação
 * ("Oxigênio (Sul)", "Nitrogênio (Sul)"). Null quando nenhum ou mais de um
 * produto aparece: melhor a pessoa escolher do que o sistema adivinhar errado.
 */
export function produtoPeloNome(texto: string): TipoProduto | null {
  const normalizado = semAcentoMinusculo(texto)
  const encontrados = PRODUTO_VALORES.filter((produto) => TERMOS_DO_PRODUTO[produto].some((termo) => normalizado.includes(termo)))
  return encontrados.length === 1 ? encontrados[0] : null
}

export function formatarProduto(produto: TipoProduto | null | undefined): string {
  return produto ? PRODUTO_LABELS[produto] : "Não informado"
}

/**
 * Quem viaja (todo tipo menos enchedor) e está sem nenhum produto autorizado.
 * O bloqueio de produto é rígido (motoristaAutorizadoParaProduto), então essa
 * pessoa some da sugestão — e fica fora da regra na escolha manual — de toda
 * viagem com produto definido. Ordem alfabética, pra lista do aviso.
 */
export function motoristasSemProdutoAutorizado<T extends { nome: string; tipo: TipoMotorista; produtosAutorizados: TipoProduto[] }>(
  motoristas: T[],
): T[] {
  return motoristas
    .filter((motorista) => podeSerAcompanhante(motorista.tipo) && motorista.produtosAutorizados.length === 0)
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"))
}
