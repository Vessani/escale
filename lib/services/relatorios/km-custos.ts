import type { StatusViagem, TipoDespesaViagem } from "@prisma/client"
import { formatarNomeProprio } from "@/lib/utils/texto"
import { totaisDespesas } from "@/lib/services/despesas-viagem"

/**
 * Relatório de km e custos por viagem: o que o motorista registrou no
 * celular (km inicial/final, pedágio, pernoite) somado por viagem, com a
 * região por onde ela passou.
 */

/** Viagens que de fato saíram — as que têm (ou vão ter) km e custos. */
export const STATUS_KM_CUSTOS: StatusViagem[] = ["INICIADA", "RETORNANDO", "FINALIZADA"]

export type ViagemKmCustos = {
  id: number
  numViagem: string
  status: StatusViagem
  inicioPrevisto: Date
  horarioRealSaida: Date | null
  finalizadoEm: Date | null
  kmInicial: number | null
  kmFinal: number | null
  cavalo: string | null
  carreta: string | null
  motorista: { id: number; nome: string } | null
  despesas: { tipo: TipoDespesaViagem; valorCentavos: number }[]
  /** Na ordem da rota. */
  entregas: { cidade: string; uf: string; sapcode: string; codewhite: string }[]
}

/** Código preenchido de verdade (não vazio, nem só zeros/traços). */
function codigoPreenchido(codigo: string | null | undefined): boolean {
  return /[1-9a-z]/i.test(codigo ?? "")
}

/**
 * Região = cidades das entregas de cliente (com SAP code E número white) —
 * fica de fora a linha de coleta/base, que não tem esses códigos. Sem
 * repetir cidade, na ordem da rota.
 */
export function regiaoDaViagem(entregas: ViagemKmCustos["entregas"]): string[] {
  const cidades: string[] = []
  for (const entrega of entregas) {
    if (!codigoPreenchido(entrega.sapcode) || !codigoPreenchido(entrega.codewhite)) continue
    const cidade = formatarNomeProprio(entrega.cidade)
    if (!cidade) continue
    const rotulo = entrega.uf.trim() ? `${cidade}/${entrega.uf.trim().toUpperCase()}` : cidade
    if (!cidades.includes(rotulo)) cidades.push(rotulo)
  }
  return cidades
}

type LinhaKmCustos = {
  id: number
  numViagem: string
  status: StatusViagem
  motorista: string | null
  cavalo: string | null
  carreta: string | null
  /** Saída real; sem ela, o início previsto. */
  inicio: Date
  inicioEhPrevisto: boolean
  fim: Date | null
  kmInicial: number | null
  kmFinal: number | null
  /** Só com os dois km. */
  kmRodado: number | null
  pedagioCentavos: number
  pernoiteCentavos: number
  custoCentavos: number
  regiao: string[]
  /** O motorista registrou algo (km ou despesa) — viagens antigas ou de quem não tem acesso não têm. */
  temRegistro: boolean
}

export function linhaKmCustos(viagem: ViagemKmCustos): LinhaKmCustos {
  const { pedagioCentavos, pernoiteCentavos } = totaisDespesas(viagem.despesas)
  const kmRodado =
    viagem.kmInicial !== null && viagem.kmFinal !== null && viagem.kmFinal >= viagem.kmInicial ? viagem.kmFinal - viagem.kmInicial : null

  return {
    id: viagem.id,
    numViagem: viagem.numViagem,
    status: viagem.status,
    motorista: viagem.motorista?.nome ?? null,
    cavalo: viagem.cavalo,
    carreta: viagem.carreta,
    inicio: viagem.horarioRealSaida ?? viagem.inicioPrevisto,
    inicioEhPrevisto: !viagem.horarioRealSaida,
    fim: viagem.status === "FINALIZADA" ? viagem.finalizadoEm : null,
    kmInicial: viagem.kmInicial,
    kmFinal: viagem.kmFinal,
    kmRodado,
    pedagioCentavos,
    pernoiteCentavos,
    custoCentavos: pedagioCentavos + pernoiteCentavos,
    regiao: regiaoDaViagem(viagem.entregas),
    temRegistro: viagem.kmInicial !== null || viagem.kmFinal !== null || viagem.despesas.length > 0,
  }
}

/** ?registro= da URL: por padrão só as viagens com registro do motorista; "todas" mostra também as sem nada. */
export function parseFiltroRegistro(texto: string | null | undefined): "com-registro" | "todas" {
  return texto === "todas" ? "todas" : "com-registro"
}

export function relatorioKmCustos(viagens: ViagemKmCustos[], filtro: "com-registro" | "todas" = "com-registro") {
  const todas = viagens.map(linhaKmCustos).sort((a, b) => a.inicio.getTime() - b.inicio.getTime())
  const linhas = filtro === "todas" ? todas : todas.filter((linha) => linha.temRegistro)
  const comRegistro = todas.filter((linha) => linha.temRegistro).length
  const comKm = linhas.filter((linha) => linha.kmRodado !== null)
  const kmRodado = comKm.reduce((total, linha) => total + (linha.kmRodado ?? 0), 0)
  const custoCentavos = linhas.reduce((total, linha) => total + linha.custoCentavos, 0)
  const custoDasComKm = comKm.reduce((total, linha) => total + linha.custoCentavos, 0)

  return {
    linhas,
    totais: {
      viagens: linhas.length,
      viagensComKm: comKm.length,
      kmRodado,
      pedagioCentavos: linhas.reduce((total, linha) => total + linha.pedagioCentavos, 0),
      pernoiteCentavos: linhas.reduce((total, linha) => total + linha.pernoiteCentavos, 0),
      custoCentavos,
      /** Média só entre as que têm registro — viagem sem nada lançado não é "custo zero". */
      custoMedioPorViagemCentavos: comRegistro ? Math.round(custoCentavos / comRegistro) : 0,
      /** Custo por km só com as viagens que têm km dos dois lados (senão o km fica subcontado). */
      custoPorKmCentavos: kmRodado > 0 ? Math.round(custoDasComKm / kmRodado) : null,
    },
  }
}
