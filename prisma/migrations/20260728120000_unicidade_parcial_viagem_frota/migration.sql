-- Torna a unicidade de "Viagem.numViagem" e "Frota.(cavalo, carreta)" válida
-- só entre registros ativos (deletadoEm IS NULL). Antes, o índice único era
-- global e um registro soft-deletado continuava bloqueando a reutilização do
-- mesmo número de viagem ou da mesma dupla cavalo/carreta.

-- Viagem
DROP INDEX IF EXISTS "Viagem_numViagem_key";
CREATE INDEX "Viagem_numViagem_idx" ON "Viagem"("numViagem");
CREATE UNIQUE INDEX "Viagem_numViagem_ativa_key" ON "Viagem"("numViagem") WHERE "deletadoEm" IS NULL;

-- Frota
DROP INDEX IF EXISTS "Frota_cavalo_carreta_key";
CREATE INDEX "Frota_cavalo_carreta_idx" ON "Frota"("cavalo", "carreta");
CREATE UNIQUE INDEX "Frota_cavalo_carreta_ativa_key" ON "Frota"("cavalo", "carreta") WHERE "deletadoEm" IS NULL;
