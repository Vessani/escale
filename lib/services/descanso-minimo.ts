/**
 * Descansos mínimos da jornada do motorista. Sem dependências de propósito:
 * o parser do relatório de jornada roda também no navegador e não pode
 * puxar @prisma/client pro bundle (ver lib/parsers/jornada-relatorio-parser.ts).
 */

/** Interjornada: descanso mínimo entre o fim de uma jornada e o início da seguinte. */
export const MINIMO_HORAS_ENTRE_JORNADAS = 11

/** Descanso semanal: folga mínima depois do 6º dia seguido (ver MAX_DIAS_SEM_FOLGA). */
export const MINIMO_HORAS_ENTRE_FOLGAS = 35
