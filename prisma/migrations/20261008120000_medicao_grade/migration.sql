-- Medição em grade (m³ / kg / %) na chegada ao cliente. Substitui a escolha
-- manômetro/balança nos registros novos; os antigos continuam como estão.

-- AlterEnum
ALTER TYPE "TipoMedicao" ADD VALUE 'GRADE';

-- AlterTable
ALTER TABLE "ChegadaEntrega" ADD COLUMN "m3Inicial" DECIMAL(12,3),
ADD COLUMN "m3Final" DECIMAL(12,3),
ADD COLUMN "kgInicial" DECIMAL(12,3),
ADD COLUMN "kgFinal" DECIMAL(12,3),
ADD COLUMN "pctInicial" DECIMAL(6,2),
ADD COLUMN "pctFinal" DECIMAL(6,2);
