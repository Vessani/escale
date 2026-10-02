/**
 * Motivos de atraso na saída, em lista (com "Outro" pra texto livre) —
 * usados na área do motorista e como sugestão no Dashboard. Deixa o
 * relatório de pontualidade agrupado por motivos iguais. Sem dependências.
 */
export const MOTIVOS_ATRASO = [
  "Troca de frota",
  "Carregamento demorado",
  "Reunião / treinamento",
  "Documentação",
  "Manutenção do veículo",
  "Trânsito",
  "Atraso do motorista",
] as const

export const MOTIVO_OUTRO = "Outro"

export const TAMANHO_MAXIMO_MOTIVO = 200
