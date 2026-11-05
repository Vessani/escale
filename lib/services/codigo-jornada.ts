import { MAX_DIAS_SEM_FOLGA } from "./dias-sem-folga"

/**
 * Códigos de jornada do calendário. De 1 a 6 o código é o próprio dia do ciclo
 * de trabalho; daí em diante é um status. Sem dependências — usado também em
 * telas do navegador.
 */
export const CODIGO_FOLGA = 7
export const CODIGO_FERIAS = 8
export const CODIGO_EXAMES = 9
export const CODIGO_INTERNO = 10
export const CODIGO_MANUTENCAO = 11

const CODIGO_JORNADA_MIN = 1

/** Rótulo de quem não está trabalhando no ciclo. */
export const ROTULO_CODIGO_PARADO: Record<number, string> = {
  [CODIGO_FOLGA]: "Folga",
  [CODIGO_FERIAS]: "Férias",
  [CODIGO_EXAMES]: "Exames",
  [CODIGO_INTERNO]: "Interno",
  [CODIGO_MANUTENCAO]: "Manutenção",
}

export function ehDiaDeTrabalho(codigo: number) {
  return codigo >= CODIGO_JORNADA_MIN && codigo <= MAX_DIAS_SEM_FOLGA
}

export function ehCodigoJornadaValido(codigo: number) {
  return Number.isInteger(codigo) && codigo >= CODIGO_JORNADA_MIN && codigo <= CODIGO_MANUTENCAO
}
