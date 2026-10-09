import type { TipoProduto } from "@prisma/client"

/**
 * Conta do total descarregado em cada cliente. Sem dependências de servidor:
 * a tela do motorista usa a mesma função pra mostrar o total enquanto ele
 * digita, e o servidor recalcula ao gravar (não confia no número da tela).
 *
 * Gases do ar e CO2: o motorista escolhe a medida que vale (manômetro ou
 * balança) e pode registrar também as outras leituras — pol, m³, kg e % —,
 * como na tela de descarga da White Martins. Cada linha tem o seu sentido:
 *  - kg:          peso do CAMINHÃO na balança — DESCE: inicial − final.
 *  - pol, m³, %:  tanque do CLIENTE — SOBE: final − inicial.
 * O total oficial vem da linha da medida escolhida:
 *  - Manômetro: pol × conversão do cliente (o motorista informa).
 *  - Balança:   kg × conversão do produto (kg → m³; CO2 fica em kg).
 * As outras linhas são registro/conferência: aparecem calculadas, não mudam o total.
 * Biometano: tanque do caminhão em polegadas e em m³; total = m³ inicial − m³ final.
 *
 * GRADE só existe nas chegadas gravadas entre 08 e 09/10/2026 (grade sem
 * escolha de medida) — só leitura.
 */

export type TipoMedicao = "MANOMETRO" | "BALANCA" | "GRADE"
export type LinhaMedicao = "POL" | "M3" | "KG" | "PCT"

export const FATOR_BALANCA: Record<Exclude<TipoProduto, "BIOMETANO">, number> = {
  ARGONIO: 0.604,
  OXIGENIO: 0.754,
  NITROGENIO: 0.862,
  CO2: 1,
}

/** Leitura absurda = erro de digitação. */
const LEITURA_MAXIMA = 1_000_000
const FATOR_MAXIMO = 10_000

export type LeiturasGrade = {
  m3Inicial?: number | null
  m3Final?: number | null
  kgInicial?: number | null
  kgFinal?: number | null
  pctInicial?: number | null
  pctFinal?: number | null
}

export type DadosDescarga = LeiturasGrade & {
  produto: TipoProduto | null
  /** Manômetro ou balança nos gases do ar/CO2; nulo no biometano. */
  medicao: "MANOMETRO" | "BALANCA" | null
  /** Só biometano: m³ do tanque do caminhão. */
  nivelInicial?: number | null
  nivelFinal?: number | null
  /** Polegadas: linha pol (gases do ar) ou tanque do caminhão (biometano). */
  polInicial?: number | null
  polFinal?: number | null
  /** Só manômetro: conversão do cliente (pol → total). */
  fatorCliente?: number | null
}

type LinhaCalculada = { inicial: number; final: number; descarregado: number }
type Linhas = {
  pol: LinhaCalculada | null
  m3: LinhaCalculada | null
  kg: (LinhaCalculada & { convertido: number }) | null
  pct: LinhaCalculada | null
}

type ResultadoDescarga =
  | {
      ok: true
      total: number
      fator: number | null
      unidade: string
      medicao: "MANOMETRO" | "BALANCA" | null
      /** Leituras da linha que deu o total (manômetro: pol; balança: kg; biometano: m³). */
      nivelInicial: number
      nivelFinal: number
      linhas: Linhas
    }
  | { ok: false; erro: string }

const arredondar = (valor: number) => Math.round(valor * 1000) / 1000
const valido = (valor: number | null | undefined): valor is number =>
  typeof valor === "number" && Number.isFinite(valor) && valor >= 0 && valor <= LEITURA_MAXIMA
const vazio = (valor: number | null | undefined) => valor === null || valor === undefined

export const NOME_LINHA: Record<LinhaMedicao, string> = { POL: "pol", M3: "m³", KG: "kg", PCT: "%" }
/** kg é o peso do caminhão (desce); o resto é o tanque do cliente (sobe). */
const LINHA_DESCE: Record<LinhaMedicao, boolean> = { POL: false, M3: false, KG: true, PCT: false }

/** Uma linha: vazia (null), válida, ou o erro pra mostrar. */
function lerLinha(
  linha: LinhaMedicao,
  inicial: number | null | undefined,
  final: number | null | undefined,
): LinhaCalculada | null | string {
  if (vazio(inicial) && vazio(final)) return null
  const nome = NOME_LINHA[linha]
  if (!valido(inicial) || !valido(final)) return `Linha ${nome}: informe o inicial e o final (só números).`
  if (linha === "PCT" && (inicial > 100 || final > 100)) return "Linha %: o nível vai de 0 a 100."
  if (LINHA_DESCE[linha]) {
    if (final > inicial) return "Linha kg (peso do caminhão): o final tem que ser menor que o inicial — confira as leituras."
    return { inicial, final, descarregado: arredondar(inicial - final) }
  }
  if (final < inicial) return `Linha ${nome} (tanque do cliente): o final tem que ser maior que o inicial — confira as leituras.`
  return { inicial, final, descarregado: arredondar(final - inicial) }
}

const SEM_LINHAS: Linhas = { pol: null, m3: null, kg: null, pct: null }

export function calcularDescarga(dados: DadosDescarga): ResultadoDescarga {
  if (!dados.produto) return { ok: false, erro: "A viagem está sem produto cadastrado — peça ao escalador pra informar." }

  if (dados.produto === "BIOMETANO") {
    if (!valido(dados.nivelInicial) || !valido(dados.nivelFinal)) {
      return { ok: false, erro: "Informe o nível inicial e o final (só números)." }
    }
    // Biometano mede o tanque do caminhão: o nível DESCE enquanto descarrega.
    if (dados.nivelFinal > dados.nivelInicial) {
      return { ok: false, erro: "O nível final está maior que o inicial — confira as leituras." }
    }
    if (!valido(dados.polInicial) || !valido(dados.polFinal)) {
      return { ok: false, erro: "Biometano: informe também o nível inicial e o final em polegadas." }
    }
    if (dados.polFinal > dados.polInicial) {
      return { ok: false, erro: "Em polegadas, o nível final está maior que o inicial — confira as leituras." }
    }
    return {
      ok: true,
      total: arredondar(dados.nivelInicial - dados.nivelFinal),
      fator: null,
      unidade: "m³",
      medicao: null,
      nivelInicial: dados.nivelInicial,
      nivelFinal: dados.nivelFinal,
      linhas: SEM_LINHAS,
    }
  }

  if (dados.medicao !== "MANOMETRO" && dados.medicao !== "BALANCA") {
    return { ok: false, erro: "Escolha o tipo de medida: manômetro ou balança." }
  }

  const lidas = {
    pol: lerLinha("POL", dados.polInicial, dados.polFinal),
    m3: lerLinha("M3", dados.m3Inicial, dados.m3Final),
    kg: lerLinha("KG", dados.kgInicial, dados.kgFinal),
    pct: lerLinha("PCT", dados.pctInicial, dados.pctFinal),
  }
  for (const linha of Object.values(lidas)) if (typeof linha === "string") return { ok: false, erro: linha }
  const { pol, m3, kg, pct } = lidas as { [K in keyof typeof lidas]: LinhaCalculada | null }

  const fatorProduto = FATOR_BALANCA[dados.produto]
  const linhas: Linhas = { pol, m3, pct, kg: kg && { ...kg, convertido: arredondar(kg.descarregado * fatorProduto) } }

  if (dados.medicao === "MANOMETRO") {
    if (!pol) return { ok: false, erro: "No manômetro, informe o nível inicial e o final em polegadas (linha pol)." }
    const fator = dados.fatorCliente
    if (typeof fator !== "number" || !Number.isFinite(fator) || fator <= 0 || fator > FATOR_MAXIMO) {
      return { ok: false, erro: "Informe a conversão do cliente (número maior que zero)." }
    }
    return {
      ok: true,
      total: arredondar(pol.descarregado * fator),
      fator,
      unidade: "",
      medicao: "MANOMETRO",
      nivelInicial: pol.inicial,
      nivelFinal: pol.final,
      linhas,
    }
  }

  if (!linhas.kg) return { ok: false, erro: "Na balança, informe o peso do caminhão antes e depois (linha kg)." }
  return {
    ok: true,
    total: linhas.kg.convertido,
    fator: fatorProduto,
    unidade: dados.produto === "CO2" ? "kg" : "m³",
    medicao: "BALANCA",
    nivelInicial: linhas.kg.inicial,
    nivelFinal: linhas.kg.final,
    linhas,
  }
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
  const normalizado = limpo.includes(",") ? limpo.replace(/\./g, "").replace(",", ".") : ehMilhar ? limpo.replace(/\./g, "") : limpo
  if (!/^\d+(\.\d+)?$/.test(normalizado)) return null
  return Number(normalizado)
}

export function formatarNumero(valor: number, casas = 3): string {
  return valor.toLocaleString("pt-BR", { maximumFractionDigits: casas })
}

/** O que já foi gravado de uma chegada, pra mostrar (card do escalador, relatório). */
type ChegadaGravada = LeiturasGrade & {
  medicao: TipoMedicao | null
  fator: number | null
  nivelInicial: number
  nivelFinal: number
  polInicial: number | null
  polFinal: number | null
}

/** Chegada gravada com as linhas (pol / m³ / kg / %) — não as antigas de uma leitura só. */
function temLinhas(chegada: ChegadaGravada): boolean {
  if (chegada.medicao === null) return false
  return [chegada.polInicial, chegada.m3Inicial, chegada.kgInicial, chegada.pctInicial].some((v) => !vazio(v))
}

/** Linha que deu o total de uma chegada GRADE (kg > m³ > %). */
function referenciaGrade(chegada: LeiturasGrade): LinhaMedicao {
  if (!vazio(chegada.kgInicial)) return "KG"
  if (!vazio(chegada.m3Inicial)) return "M3"
  return "PCT"
}

/** "Manômetro × 12,5", "Balança × 0,754", "Balança (kg)", "Biometano" (e "Grade (...)" das chegadas GRADE). */
export function textoMedicao(chegada: Pick<ChegadaGravada, "medicao" | "fator"> & LeiturasGrade): string {
  if (chegada.medicao === "GRADE") {
    const ref = referenciaGrade(chegada)
    if (ref === "KG") return chegada.fator === 1 ? "Grade (kg)" : `Grade (kg × ${formatarNumero(chegada.fator ?? 0, 4)})`
    return `Grade (${NOME_LINHA[ref]})`
  }
  if (chegada.medicao === "MANOMETRO") return `Manômetro × ${formatarNumero(chegada.fator ?? 0, 4)}`
  if (chegada.medicao === "BALANCA") return chegada.fator === 1 ? "Balança (kg)" : `Balança × ${formatarNumero(chegada.fator ?? 0, 4)}`
  return "Biometano"
}

/** Unidade do total: manômetro depende da conversão do cliente (sem unidade). */
export function unidadeDescarga(chegada: Pick<ChegadaGravada, "medicao" | "fator"> & LeiturasGrade): string {
  if (chegada.medicao === "GRADE") {
    const ref = referenciaGrade(chegada)
    if (ref === "PCT") return "%"
    return ref === "KG" && chegada.fator === 1 ? "kg" : "m³"
  }
  if (chegada.medicao === "MANOMETRO") return ""
  return chegada.medicao === "BALANCA" && chegada.fator === 1 ? "kg" : "m³"
}

/**
 * Antigas: "1.000 → 400"; biometano: "950 → 200 m³ (80 → 15 pol)";
 * com linhas: "pol 51 → 72 · m³ 35.515,4 → 50.139,39 · kg 47.760 → 23.400" (só as preenchidas).
 */
export function textoLeituras(chegada: ChegadaGravada): string {
  if (temLinhas(chegada)) {
    const partes: string[] = []
    const linha = (nome: string, ini: number | null | undefined, fim: number | null | undefined) => {
      if (!vazio(ini) && !vazio(fim)) partes.push(`${nome} ${formatarNumero(ini as number)} → ${formatarNumero(fim as number)}`)
    }
    linha("pol", chegada.polInicial, chegada.polFinal)
    linha("m³", chegada.m3Inicial, chegada.m3Final)
    linha("kg", chegada.kgInicial, chegada.kgFinal)
    linha("%", chegada.pctInicial, chegada.pctFinal)
    return partes.join(" · ")
  }
  const base = `${formatarNumero(chegada.nivelInicial)} → ${formatarNumero(chegada.nivelFinal)}`
  return chegada.polInicial !== null && chegada.polFinal !== null
    ? `${base} m³ (${formatarNumero(chegada.polInicial, 2)} → ${formatarNumero(chegada.polFinal, 2)} pol)`
    : base
}

/** Decimal do banco (Prisma) ou número → número. */
const numero = (valor: unknown) => Number(valor)
const numeroOuNulo = (valor: unknown) => (valor === null || valor === undefined ? null : Number(valor))

/** ChegadaEntrega do banco (campos Decimal) com os números prontos pra conta e pra tela — um lugar só. */
export function chegadaEmNumeros<
  T extends {
    nivelInicial: unknown
    nivelFinal: unknown
    polInicial: unknown
    polFinal: unknown
    fator: unknown
    totalDescarregado: unknown
    m3Inicial?: unknown
    m3Final?: unknown
    kgInicial?: unknown
    kgFinal?: unknown
    pctInicial?: unknown
    pctFinal?: unknown
  },
>(chegada: T) {
  return {
    ...chegada,
    nivelInicial: numero(chegada.nivelInicial),
    nivelFinal: numero(chegada.nivelFinal),
    polInicial: numeroOuNulo(chegada.polInicial),
    polFinal: numeroOuNulo(chegada.polFinal),
    fator: numeroOuNulo(chegada.fator),
    totalDescarregado: numero(chegada.totalDescarregado),
    m3Inicial: numeroOuNulo(chegada.m3Inicial),
    m3Final: numeroOuNulo(chegada.m3Final),
    kgInicial: numeroOuNulo(chegada.kgInicial),
    kgFinal: numeroOuNulo(chegada.kgFinal),
    pctInicial: numeroOuNulo(chegada.pctInicial),
    pctFinal: numeroOuNulo(chegada.pctFinal),
  }
}
