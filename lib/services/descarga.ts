import type { TipoProduto } from "@prisma/client"

/**
 * Conta do total descarregado em cada cliente. Sem dependências de servidor:
 * a tela do motorista usa a mesma função pra mostrar o total enquanto ele
 * digita, e o servidor recalcula ao gravar (não confia no número da tela).
 *
 * Cada medida lê um tanque diferente:
 *  - Manômetro: tanque do CLIENTE, em polegadas — sobe com a descarga:
 *    (final − inicial) × conversão do cliente (o motorista informa).
 *  - Balança:   peso do CAMINHÃO — desce com a descarga:
 *    (inicial − final) × conversão do produto (kg → m³; CO2 fica em kg).
 *  - Biometano: tanque do caminhão em polegadas e em m³; total = m³ inicial − m³ final.
 */

export type TipoMedicao = "MANOMETRO" | "BALANCA"

export const FATOR_BALANCA: Record<Exclude<TipoProduto, "BIOMETANO">, number> = {
  ARGONIO: 0.604,
  OXIGENIO: 0.754,
  NITROGENIO: 0.862,
  CO2: 1,
}

/** Leitura absurda = erro de digitação. */
const LEITURA_MAXIMA = 1_000_000
const FATOR_MAXIMO = 10_000

export type DadosDescarga = {
  produto: TipoProduto | null
  medicao: TipoMedicao | null
  nivelInicial: number | null
  nivelFinal: number | null
  /** Só manômetro. */
  fatorCliente?: number | null
  /** Só biometano. */
  polInicial?: number | null
  polFinal?: number | null
}

type ResultadoDescarga =
  | { ok: true; total: number; fator: number | null; unidade: string; medicao: TipoMedicao | null; nivelInicial: number; nivelFinal: number }
  | { ok: false; erro: string }

const arredondar = (valor: number) => Math.round(valor * 1000) / 1000
const valido = (valor: number | null | undefined): valor is number =>
  typeof valor === "number" && Number.isFinite(valor) && valor >= 0 && valor <= LEITURA_MAXIMA

export function calcularDescarga(dados: DadosDescarga): ResultadoDescarga {
  if (!dados.produto) return { ok: false, erro: "A viagem está sem produto cadastrado — peça ao escalador pra informar." }
  if (!valido(dados.nivelInicial) || !valido(dados.nivelFinal)) {
    return { ok: false, erro: "Informe o nível inicial e o final (só números)." }
  }
  const niveis = { nivelInicial: dados.nivelInicial, nivelFinal: dados.nivelFinal }

  // Manômetro mede o tanque do cliente: o nível SOBE enquanto descarrega.
  if (dados.produto !== "BIOMETANO" && dados.medicao === "MANOMETRO") {
    if (dados.nivelFinal < dados.nivelInicial) {
      return { ok: false, erro: "No manômetro (tanque do cliente) o nível final é maior que o inicial — confira as leituras." }
    }
    const fator = dados.fatorCliente
    if (typeof fator !== "number" || !Number.isFinite(fator) || fator <= 0 || fator > FATOR_MAXIMO) {
      return { ok: false, erro: "Informe a conversão do cliente (número maior que zero)." }
    }
    return { ok: true, total: arredondar((dados.nivelFinal - dados.nivelInicial) * fator), fator, unidade: "", medicao: "MANOMETRO", ...niveis }
  }

  // Balança e biometano medem o caminhão: o nível DESCE enquanto descarrega.
  if (dados.nivelFinal > dados.nivelInicial) {
    return { ok: false, erro: "O nível final está maior que o inicial — confira as leituras." }
  }
  const diferenca = dados.nivelInicial - dados.nivelFinal

  if (dados.produto === "BIOMETANO") {
    if (!valido(dados.polInicial) || !valido(dados.polFinal)) {
      return { ok: false, erro: "Biometano: informe também o nível inicial e o final em polegadas." }
    }
    if (dados.polFinal > dados.polInicial) {
      return { ok: false, erro: "Em polegadas, o nível final está maior que o inicial — confira as leituras." }
    }
    return { ok: true, total: arredondar(diferenca), fator: null, unidade: "m³", medicao: null, ...niveis }
  }

  if (dados.medicao === "BALANCA") {
    const fator = FATOR_BALANCA[dados.produto]
    return { ok: true, total: arredondar(diferenca * fator), fator, unidade: dados.produto === "CO2" ? "kg" : "m³", medicao: "BALANCA", ...niveis }
  }

  return { ok: false, erro: "Escolha o tipo de medida: manômetro ou balança." }
}

/** "12,5" / "1.234,5" / "12.5" → número; vazio ou inválido → null. */
export function parseNumeroDecimal(texto: string, opcoes: { pontoDecimal?: boolean } = {}): number | null {
  const limpo = texto.trim().replace(/\s/g, "")
  if (!limpo) return null
  // Com vírgula, o ponto é separador de milhar. Sem vírgula: "1.000" e
  // "152.300" (grupos de 3) são milhar — é como se escreve mil no Brasil;
  // "12.5" é decimal. Nunca milhar: começando com "0." ("0.754") ou quando o
  // campo é de fator de conversão (`pontoDecimal`) — teclado de celular que
  // só tem ponto não pode virar um fator mil vezes maior.
  const ehMilhar = !opcoes.pontoDecimal && /^[1-9]\d{0,2}(\.\d{3})+$/.test(limpo)
  const normalizado = limpo.includes(",")
    ? limpo.replace(/\./g, "").replace(",", ".")
    : ehMilhar
      ? limpo.replace(/\./g, "")
      : limpo
  if (!/^\d+(\.\d+)?$/.test(normalizado)) return null
  return Number(normalizado)
}

export function formatarNumero(valor: number, casas = 3): string {
  return valor.toLocaleString("pt-BR", { maximumFractionDigits: casas })
}

/** O que já foi gravado de uma chegada, pra mostrar (card do escalador, relatório). */
type ChegadaGravada = {
  medicao: TipoMedicao | null
  fator: number | null
  nivelInicial: number
  nivelFinal: number
  polInicial: number | null
  polFinal: number | null
}

/** "Manômetro × 12,5", "Balança × 0,754", "Balança (kg)", "Biometano". */
export function textoMedicao(chegada: Pick<ChegadaGravada, "medicao" | "fator">): string {
  if (chegada.medicao === "MANOMETRO") return `Manômetro × ${formatarNumero(chegada.fator ?? 0, 4)}`
  if (chegada.medicao === "BALANCA") return chegada.fator === 1 ? "Balança (kg)" : `Balança × ${formatarNumero(chegada.fator ?? 0, 4)}`
  return "Biometano"
}

/** Unidade do total: manômetro depende da conversão do cliente (sem unidade). */
export function unidadeDescarga(chegada: Pick<ChegadaGravada, "medicao" | "fator">): string {
  if (chegada.medicao === "MANOMETRO") return ""
  return chegada.medicao === "BALANCA" && chegada.fator === 1 ? "kg" : "m³"
}

/** "1.000 → 400" (biometano: "950 → 200 m³ (80 → 15 pol)"). */
export function textoLeituras(chegada: ChegadaGravada): string {
  const base = `${formatarNumero(chegada.nivelInicial)} → ${formatarNumero(chegada.nivelFinal)}`
  return chegada.polInicial !== null && chegada.polFinal !== null
    ? `${base} m³ (${formatarNumero(chegada.polInicial, 2)} → ${formatarNumero(chegada.polFinal, 2)} pol)`
    : base
}

/** Decimal do banco (Prisma) ou número → número. */
const numero = (valor: unknown) => Number(valor)
const numeroOuNulo = (valor: unknown) => (valor === null || valor === undefined ? null : Number(valor))

/** ChegadaEntrega do banco (campos Decimal) com os números prontos pra conta e pra tela — um lugar só. */
export function chegadaEmNumeros<T extends { nivelInicial: unknown; nivelFinal: unknown; polInicial: unknown; polFinal: unknown; fator: unknown; totalDescarregado: unknown }>(
  chegada: T,
) {
  return {
    ...chegada,
    nivelInicial: numero(chegada.nivelInicial),
    nivelFinal: numero(chegada.nivelFinal),
    polInicial: numeroOuNulo(chegada.polInicial),
    polFinal: numeroOuNulo(chegada.polFinal),
    fator: numeroOuNulo(chegada.fator),
    totalDescarregado: numero(chegada.totalDescarregado),
  }
}

