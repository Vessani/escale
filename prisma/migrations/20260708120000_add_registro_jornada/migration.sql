-- Histórico de jornada por dia (motorista + data -> código). diasTrabalhados
-- no Motorista continua existindo como cache do registro de hoje.
CREATE TABLE "RegistroJornada" (
    "id" SERIAL NOT NULL,
    "motoristaId" INTEGER NOT NULL,
    "data" DATE NOT NULL,
    "codigo" INTEGER NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RegistroJornada_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RegistroJornada_motoristaId_data_key" ON "RegistroJornada"("motoristaId", "data");

ALTER TABLE "RegistroJornada" ADD CONSTRAINT "RegistroJornada_motoristaId_fkey"
  FOREIGN KEY ("motoristaId") REFERENCES "Motorista"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- Backfill: registro de hoje para cada motorista existente, preservando o
-- diasTrabalhados atual (o calendário continua mostrando o mesmo estado).
INSERT INTO "RegistroJornada" ("motoristaId", "data", "codigo", "atualizadoEm")
SELECT "id", CURRENT_DATE, "diasTrabalhados", CURRENT_TIMESTAMP
FROM "Motorista"
WHERE "deletadoEm" IS NULL;

-- Segue o mesmo padrão de segurança já aplicado às demais tabelas públicas.
ALTER TABLE "RegistroJornada" ENABLE ROW LEVEL SECURITY;
