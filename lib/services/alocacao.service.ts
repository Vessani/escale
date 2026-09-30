/**
 * Barrel — o módulo virou uma pasta (lib/services/alocacao/), dividido por
 * responsabilidade: compatibilidade (turno/jornada/produto/integração),
 * disponibilidade (conflito de agenda com descanso legal), priorizacao
 * (ordenação/desempate), sugestao (sugestão individual e em lote), descanso
 * (regra única de descanso antes da viagem) e avisos (aviso de interjornada,
 * não bloqueio). Todo import existente de "@/lib/services/alocacao.service"
 * continua funcionando sem alteração.
 */
export * from "./alocacao/tipos"
export * from "./alocacao/compatibilidade"
export * from "./alocacao/disponibilidade"
export * from "./alocacao/priorizacao"
export * from "./alocacao/sugestao"
export * from "./alocacao/descanso"
export * from "./alocacao/avisos"
