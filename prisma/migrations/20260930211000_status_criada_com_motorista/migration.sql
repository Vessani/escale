-- Corrige viagens gravadas com status incoerente com a alocação: o formulário
-- de nova viagem mandava "CRIADA" mesmo com motorista escolhido. A partir
-- daqui toda gravação passa por normalizarStatusPorAlocacao
-- (lib/services/viagem.service.ts); isto acerta o que já estava no banco.
-- Só mexe em CRIADA/ALOCADA — os demais status não dependem do motorista.
UPDATE "Viagem" SET "status" = 'ALOCADA'
WHERE "status" = 'CRIADA' AND "motoristaId" IS NOT NULL;

UPDATE "Viagem" SET "status" = 'CRIADA'
WHERE "status" = 'ALOCADA' AND "motoristaId" IS NULL;
