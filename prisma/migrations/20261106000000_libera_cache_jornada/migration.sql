-- O código de jornada agora vem só do RegistroJornada. Quem ainda está sem
-- registro ganha o de hoje (horário de Brasília) a partir do cache, enquanto ele
-- existe. Depois a coluna deixa de ser obrigatória: o código novo não grava mais
-- nela, e ela só some numa migration seguinte, com este deploy já no ar. Nesta
-- ordem o código antigo, que ainda roda durante o build, segue funcionando.
INSERT INTO "RegistroJornada" ("motoristaId", "data", "codigo", "atualizadoEm")
SELECT m."id", ((now() AT TIME ZONE 'UTC') - interval '3 hours')::date, m."diasTrabalhados", now()
FROM "Motorista" m
WHERE m."deletadoEm" IS NULL
  AND m."diasTrabalhados" BETWEEN 1 AND 11
  AND NOT EXISTS (SELECT 1 FROM "RegistroJornada" r WHERE r."motoristaId" = m."id");

ALTER TABLE "Motorista" ALTER COLUMN "diasTrabalhados" DROP NOT NULL;
