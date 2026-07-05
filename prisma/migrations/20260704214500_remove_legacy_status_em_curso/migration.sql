UPDATE "Viagem"
SET "status" = 'INICIADA'
WHERE "status" = 'EM_CURSO';

CREATE TYPE "StatusViagem_new" AS ENUM (
  'CRIADA',
  'ALOCADA',
  'INICIADA',
  'RETORNANDO',
  'POSTERGADA',
  'FINALIZADA',
  'CANCELADA'
);

ALTER TABLE "Viagem"
ALTER COLUMN "status" DROP DEFAULT,
ALTER COLUMN "status" TYPE "StatusViagem_new"
USING ("status"::text::"StatusViagem_new"),
ALTER COLUMN "status" SET DEFAULT 'CRIADA';

ALTER TYPE "StatusViagem" RENAME TO "StatusViagem_old";
ALTER TYPE "StatusViagem_new" RENAME TO "StatusViagem";
DROP TYPE "StatusViagem_old";
