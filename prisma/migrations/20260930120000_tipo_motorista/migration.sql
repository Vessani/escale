-- Motorista.liberado (boolean) vira Motorista.tipo (enum), pra comportar
-- instrutor, interno e enchedor além de "em treinamento". Quem estava com
-- liberado = false vira TREINAMENTO; o resto, MOTORISTA.
CREATE TYPE "TipoMotorista" AS ENUM ('MOTORISTA', 'TREINAMENTO', 'INSTRUTOR', 'INTERNO', 'ENCHEDOR');

ALTER TABLE "Motorista" ADD COLUMN "tipo" "TipoMotorista" NOT NULL DEFAULT 'MOTORISTA';

UPDATE "Motorista" SET "tipo" = 'TREINAMENTO' WHERE "liberado" = false;

ALTER TABLE "Motorista" DROP COLUMN "liberado";
