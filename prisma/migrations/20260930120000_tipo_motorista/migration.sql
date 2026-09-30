-- Motorista.liberado (boolean) vira Motorista.tipo (enum), pra comportar
-- instrutor, interno e enchedor além de "em treinamento". Quem estava com
-- liberado = false vira TREINAMENTO; o resto, MOTORISTA.
CREATE TYPE "TipoMotorista" AS ENUM ('MOTORISTA', 'TREINAMENTO', 'INSTRUTOR', 'INTERNO', 'ENCHEDOR');

ALTER TABLE "Motorista" ADD COLUMN "tipo" "TipoMotorista" NOT NULL DEFAULT 'MOTORISTA';

UPDATE "Motorista" SET "tipo" = 'TREINAMENTO' WHERE "liberado" = false;

-- A coluna antiga NÃO é removida aqui de propósito: durante o deploy, a
-- versão anterior do app continua no ar enquanto a nova é construída e
-- ainda lê/grava "liberado". O Prisma ignora a coluna a mais. Remover numa
-- migration futura, depois que esta versão estiver no ar:
--   ALTER TABLE "Motorista" DROP COLUMN "liberado";
