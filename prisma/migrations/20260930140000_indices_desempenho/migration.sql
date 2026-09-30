-- Índices pras consultas mais frequentes (ver schema.prisma). O Postgres não
-- cria índice pra chave estrangeira sozinho: sem eles, carregar as entregas
-- de uma viagem (ou as integrações de um motorista) varria a tabela inteira.
CREATE INDEX IF NOT EXISTS "Entrega_viagemId_idx" ON "Entrega"("viagemId");
CREATE INDEX IF NOT EXISTS "Integracao_motoristaId_idx" ON "Integracao"("motoristaId");

-- Lista paginada da Gestão de Viagens e Dashboard: filial + período, ordenado por início.
CREATE INDEX IF NOT EXISTS "Viagem_filialId_inicioPrevisto_idx" ON "Viagem"("filialId", "inicioPrevisto");
