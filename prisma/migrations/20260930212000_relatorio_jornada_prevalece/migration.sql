-- Relatório de Jornada prevalece sobre viagem do Escale nos dias que ele cobre.
ALTER TABLE "Filial" ADD COLUMN "relatorioJornadaAte" DATE;
ALTER TABLE "Viagem" ADD COLUMN "avisoRelatorioJornada" TEXT;

-- Cobertura a partir do que já foi importado: só linhas vindas do relatório
-- têm fimJornada (edição manual do calendário não preenche).
UPDATE "Filial" f
SET "relatorioJornadaAte" = sub.ate
FROM (
  SELECT m."filialId", MAX(r."data") AS ate
  FROM "RegistroJornada" r
  JOIN "Motorista" m ON m."id" = r."motoristaId"
  WHERE r."fimJornada" IS NOT NULL
  GROUP BY m."filialId"
) sub
WHERE sub."filialId" = f."id";
