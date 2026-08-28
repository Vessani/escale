/**
 * Barrel — o módulo virou uma pasta (lib/services/alocacao/), dividido por
 * responsabilidade: compatibilidade (turno/jornada/produto/integração),
 * disponibilidade (conflito de agenda com descanso legal), priorizacao
 * (ordenação/desempate), sugestao (sugestão individual e em lote) e avisos
 * (aviso de interjornada, não bloqueio). Refatoração pura — nenhuma lógica
 * mudou, só a organização dos arquivos; todo import existente de
 * "@/lib/services/alocacao.service" continua funcionando sem alteração.
 */
export * from "./alocacao/tipos"
export * from "./alocacao/compatibilidade"
export * from "./alocacao/disponibilidade"
export * from "./alocacao/priorizacao"
export * from "./alocacao/sugestao"
export * from "./alocacao/avisos"
