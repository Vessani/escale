import type { TipoProduto } from "@prisma/client"

/**
 * Conta do total descarregado em cada cliente. Sem dependências de servidor:
 * a tela do motorista usa a mesma função pra mostrar o total enquanto ele
 * digita, e o servidor recalcula ao gravar (não confia no número da tela).
 *
 * Grade (gases do ar e CO2): três linhas — m³, kg e % — cada uma com inicial
 * e final. O motorista preenche a que o medidor dele mostra (ou mais de uma).
 *  - Toda linha SOBE com a descarga: descarregado = final − inicial.
 *  - kg vira m³ pela conversão do produto (CO2 fica em kg).
 *  - % não tem conversão: o resultado fica em pontos percentuais.
 *  - Total oficial = a linha de referência, nessa ordem: kg (balança, a mais
 *    precisa) > m³ > %.
 *  - kg e m³ preenchidos juntos: se divergirem mais que a tolerância, avisa
 *    (não bloqueia — o total continua sendo o do kg).
 * Biometano: tanque do caminhão em polegadas e em m³; total = m³ inicial − m³ final.
 *
 * MANOMETRO e BALANCA só existem em registros antigos (antes da grade).
 */

export type TipoMedicao = "MANOMETRO" | "BALANCA" | "GRADE"
export type LinhaGrade = "KG" | "M3" | "PCT"

export const FATOR_BALANCA: Record<Exclude<TipoProduto, "BIOMETANO">, number> = {
  ARGONIO: 0.604,
  OXIGENIO: 0.754,
  NITROGENIO: 0.862,
  CO2: 1,
}

/** Diferença aceita entre kg convertido e m³ antes de avisar (3%). */
const TOLERANCIA_DIVERGENCIA = 0.03

/** Leitura absurda = erro de digitação. */
const LEITURA_MAXIMA = 1_000_000

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
  /** GRADE nos gases do ar/CO2; nulo no biometano. */
  medicao: "GRADE" | null
  /** Só biometano: m³ do tanque do caminhão. */
  nivelInicial?: number | null
  nivelFinal?: number | null
  /** Só biometano. */
  polInicial?: number | null
  polFinal?: number | null
}

type LinhaCalculada = { inicial: number; final: number; descarregado: number }

type ResultadoDescarga =
  | {
      ok: true
      total: number
      fator: number | null
      unidade: string
      medicao: "GRADE" | null
      /** Leituras da linha de referência (biometano: m³). */
      nivelInicial: number
      nivelFinal: number
      /** Só grade. */
      referencia: LinhaGrade | null
      linhas: { kg: (LinhaCalculada & { convertido: number }) | null; m3: LinhaCalculada | null; pct: LinhaCalculada | null }
      aviso: string | null
    }
  | { ok: false; erro: string }

const arredondar = (valor: number) => Math.round(valor * 1000) / 1000
const valido = (valor: number | null | undefined): valor is number =>
  typeof valor === "number" && Number.isFinite(valor) && valor >= 0 && valor <= LEITURA_MAXIMA
const vazio = (valor: number | null | undefined) => valor === null || valor === undefined

const NOME_LINHA: Record<LinhaGrade, string> = { KG: "kg", M3: "m³", PCT: "%" }

/** Uma linha da grade: vazia (null), válida, ou o erro pra mostrar. */
function lerLinha(linha: LinhaGrade, inicial: number | null | undefined, final: number | null | undefined): LinhaCalculada | null | string {
  if (vazio(inicial) && vazio(final)) return null
  const nome = NOME_LINHA[linha]
  if (!valido(inicial) || !valido(final)) return `Linha ${nome}: informe o inicial e o final (só números).`
  if (linha === "PCT" && (inicial > 100 || final > 100)) return "Linha %: o nível vai de 0 a 100."
  if (final < inicial) return `Linha ${nome}: o final tem que ser maior que o inicial (sobe com a descarga) — confira as leituras.`
  return { inicial, final, descarregado: arredondar(final - inicial) }
}

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
      referencia: null,
      linhas: { kg: null, m3: null, pct: null },
      aviso: null,
    }
  }

  const kg = lerLinha("KG", dados.kgInicial, dados.kgFinal)
  const m3 = lerLinha("M3", dados.m3Inicial, dados.m3Final)
  const pct = lerLinha("PCT", dados.pctInicial, dados.pctFinal)
  for (const linha of [kg, m3, pct]) if (typeof linha === "string") return { ok: false, erro: linha }
  const [lkg, lm3, lpct] = [kg, m3, pct] as (LinhaCalculada | null)[]
  if (!lkg && !lm3 && !lpct) return { ok: false, erro: "Preencha pelo menos uma linha da medição (m³, kg ou %)." }

  const fator = FATOR_BALANCA[dados.produto]
  const co2 = dados.produto === "CO2"
  const kgConvertido = lkg && { ...lkg, convertido: arredondar(lkg.descarregado * fator) }

  let aviso: string | null = null
  if (kgConvertido && lm3 && !co2) {
    const base = Math.max(kgConvertido.convertido, lm3.descarregado)
    if (base > 0 && Math.abs(kgConvertido.convertido - lm3.descarregado) / base > TOLERANCIA_DIVERGENCIA) {
      aviso =
        `kg e m³ não batem: ${formatarNumero(kgConvertido.convertido)} m³ pela balança × ` +
        `${formatarNumero(lm3.descarregado)} m³ informado. Vale conferir — o total usa a balança.`
    }
  }

  const linhas = { kg: kgConvertido, m3: lm3, pct: lpct }
  const comum = { ok: true as const, medicao: "GRADE" as const, linhas, aviso }
  if (kgConvertido) {
    return {
      ...comum,
      total: kgConvertido.convertido,
      fator,
      unidade: co2 ? "kg" : "m³",
      nivelInicial: kgConvertido.inicial,
      nivelFinal: kgConvertido.final,
      referencia: "KG",
    }
  }
  if (lm3) {
    return {
      ...comum,
      total: lm3.descarregado,
      fator: null,
      unidade: "m³",
      nivelInicial: lm3.inicial,
      nivelFinal: lm3.final,
      referencia: "M3",
    }
  }
  const p = lpct as LinhaCalculada
  return { ...comum, total: p.descarregado, fator: null, unidade: "%", nivelInicial: p.inicial, nivelFinal: p.final, referencia: "PCT" }
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

/** Linha que deu o total de uma chegada em grade (kg > m³ > %). */
function referenciaDaGrade(chegada: LeiturasGrade): LinhaGrade {
  if (!vazio(chegada.kgInicial)) return "KG"
  if (!vazio(chegada.m3Inicial)) return "M3"
  return "PCT"
}

/** "Grade (kg × 0,754)", "Grade (m³)", "Manômetro × 12,5", "Balança × 0,754", "Biometano". */
export function textoMedicao(chegada: Pick<ChegadaGravada, "medicao" | "fator"> & LeiturasGrade): string {
  if (chegada.medicao === "GRADE") {
    const ref = referenciaDaGrade(chegada)
    if (ref === "KG") return chegada.fator === 1 ? "Grade (kg)" : `Grade (kg × ${formatarNumero(chegada.fator ?? 0, 4)})`
    return `Grade (${NOME_LINHA[ref]})`
  }
  if (chegada.medicao === "MANOMETRO") return `Manômetro × ${formatarNumero(chegada.fator ?? 0, 4)}`
  if (chegada.medicao === "BALANCA") return chegada.fator === 1 ? "Balança (kg)" : `Balança × ${formatarNumero(chegada.fator ?? 0, 4)}`
  return "Biometano"
}

/** Unidade do total: manômetro antigo depende da conversão do cliente (sem unidade). */
export function unidadeDescarga(chegada: Pick<ChegadaGravada, "medicao" | "fator"> & LeiturasGrade): string {
  if (chegada.medicao === "GRADE") {
    const ref = referenciaDaGrade(chegada)
    if (ref === "PCT") return "%"
    return ref === "KG" && chegada.fator === 1 ? "kg" : "m³"
  }
  if (chegada.medicao === "MANOMETRO") return ""
  return chegada.medicao === "BALANCA" && chegada.fator === 1 ? "kg" : "m³"
}

/**
 * "1.000 → 400"; biometano: "950 → 200 m³ (80 → 15 pol)";
 * grade: "kg 400 → 1.000 · m³ 0,3 → 0,75 · % 10 → 45" (só as linhas preenchidas).
 */
export function textoLeituras(chegada: ChegadaGravada): string {
  if (chegada.medicao === "GRADE") {
    const partes: string[] = []
    const linha = (nome: string, ini: number | null | undefined, fim: number | null | undefined) => {
      if (!vazio(ini) && !vazio(fim)) partes.push(`${nome} ${formatarNumero(ini as number)} → ${formatarNumero(fim as number)}`)
    }
    linha("kg", chegada.kgInicial, chegada.kgFinal)
    linha("m³", chegada.m3Inicial, chegada.m3Final)
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
