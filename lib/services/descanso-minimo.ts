/**
 * Descansos mínimos da jornada do motorista. Sem dependências de propósito:
 * o parser do relatório de jornada roda também no navegador e não pode
 * puxar @prisma/client pro bundle (ver lib/parsers/jornada-relatorio-parser.ts).
 */

/** Interjornada: descanso mínimo entre o fim de uma jornada e o início da seguinte. */
export const MINIMO_HORAS_ENTRE_JORNADAS = 11

/** Descanso semanal: folga mínima depois do 6º dia seguido (ver MAX_DIAS_SEM_FOLGA). */
export const MINIMO_HORAS_ENTRE_FOLGAS = 35

/** O motorista se apresenta 1h antes do horário da viagem, pro checklist. */
const HORAS_ANTECEDENCIA_CHECKLIST = 1

/**
 * Horário de apresentação do motorista pra uma viagem: o início da jornada
 * dele, 1h antes do horário da viagem. É ATÉ AQUI que o descanso
 * (interjornada/semanal) precisa ter terminado — não até o horário da
 * viagem. Fonte única pra sugestão, aviso gravado na viagem e conflito
 * entre viagens.
 */
export function calcularHorarioIdealChegada(dataInicioViagem: Date): Date {
  return new Date(dataInicioViagem.getTime() - HORAS_ANTECEDENCIA_CHECKLIST * 60 * 60 * 1000)
}

/** Inverso de calcularHorarioIdealChegada: horário de viagem pra quem se apresenta em `apresentacao`. */
export function calcularInicioViagemPelaApresentacao(apresentacao: Date): Date {
  return new Date(apresentacao.getTime() + HORAS_ANTECEDENCIA_CHECKLIST * 60 * 60 * 1000)
}
