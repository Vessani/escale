-- Separa "em manutenção" (manual) de "em viagem" (automático, via
-- disponivelEm) — antes os dois casos caíam no mesmo status porque só
-- existia disponivelEm. Ver comentário no model Frota.
ALTER TABLE "Frota" ADD COLUMN "emManutencao" BOOLEAN NOT NULL DEFAULT false;
