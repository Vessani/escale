import { ErroDeDominio } from "@/lib/errors"

/**
 * Limites do que o motorista/escalador registra durante a viagem (km e hora
 * de chegada, troca, encerramento) — num lugar só, pra chegada, troca e
 * encerramento recusarem as mesmas coisas com as mesmas palavras.
 */

/** Problema mecânico: no máximo isso de texto. */
export const TAMANHO_MAXIMO_PROBLEMA = 300

/** Pedágio/pernoite: R$ 10.000,00 por lançamento — acima disso é erro de digitação. */
export const VALOR_MAXIMO_CENTAVOS = 1_000_000

/** Hodômetro: até 9.999.999 km. */
export const KM_MAXIMO_HODOMETRO = 9_999_999
/** Uma viagem não roda mais que isso — acima é erro de digitação. */
export const KM_MAXIMO_POR_VIAGEM = 10_000
/** Hora "no futuro" além disso = relógio errado ou digitação. */
const FOLGA_FUTURO_MS = 5 * 60 * 1000

/** Os campos de data/hora não têm segundos: compara por minuto (saiu 14:29:40 e chegou "14:29" é o mesmo minuto). */
export function inicioDoMinuto(data: Date): number {
  return Math.floor(data.getTime() / 60_000) * 60_000
}

/** Km de um registro no meio da viagem (chegada, troca): entre o km inicial e +10.000. */
export function validarKmDoRegistro(km: number, kmInicial: number | null, rotulo: string) {
  if (!Number.isInteger(km) || km < 0 || km > KM_MAXIMO_HODOMETRO) {
    throw new ErroDeDominio("KM_INVALIDO", `${rotulo}: informe o número do hodômetro, só números.`)
  }
  if (kmInicial === null) return
  if (km < kmInicial) throw new ErroDeDominio("KM_MENOR_QUE_INICIAL", `${rotulo}: não pode ser menor que o km inicial (${kmInicial}).`)
  if (km - kmInicial > KM_MAXIMO_POR_VIAGEM)
    throw new ErroDeDominio("KM_ALTO", `${rotulo}: mais de 10.000 km desde a saída — confira o km.`)
}

/** Hora de um registro no meio da viagem: nem no futuro, nem antes da saída. */
export function validarHoraDoRegistro(quando: Date, saida: Date | null, agora: Date, evento: string) {
  if (Number.isNaN(quando.getTime()) || quando.getTime() > agora.getTime() + FOLGA_FUTURO_MS) {
    throw new ErroDeDominio("HORA_NO_FUTURO", `A hora da ${evento} está no futuro — confira a data e a hora.`)
  }
  if (saida && quando.getTime() < inicioDoMinuto(saida)) {
    throw new ErroDeDominio("HORA_ANTES_DA_SAIDA", `A hora da ${evento} é antes da saída da viagem — confira a data e a hora.`)
  }
}
