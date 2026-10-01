/**
 * Máximo de dias seguidos de trabalho antes da folga obrigatória. O 7º dia
 * seguido é "folga estourada": o fornecedor do relatório de jornada usa a
 * mesma regra, mas acontece (ex: motorista bate o ponto antes da hora na
 * volta do descanso e o dia conta como seguido). Sem dependências — usado
 * também em telas do navegador.
 */
export const MAX_DIAS_SEM_FOLGA = 6

export function folgaEstourada(diasSemFolga: number | null | undefined): boolean {
  return typeof diasSemFolga === "number" && diasSemFolga > MAX_DIAS_SEM_FOLGA
}
