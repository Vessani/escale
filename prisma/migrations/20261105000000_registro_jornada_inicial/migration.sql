-- Motorista sem nenhum RegistroJornada dependia do cache diasTrabalhados como
-- ponto de partida. O código atual vira o registro de hoje (horário de
-- Brasília), como o cadastro já faz com motorista novo: é o que permite
-- remover o cache depois. Só insere: o código antigo segue funcionando.
INSERT INTO "RegistroJornada" ("motoristaId", "data", "codigo", "atualizadoEm")
SELECT m."id", ((now() AT TIME ZONE 'UTC') - interval '3 hours')::date, m."diasTrabalhados", now()
FROM "Motorista" m
WHERE m."deletadoEm" IS NULL
  AND m."diasTrabalhados" BETWEEN 1 AND 11
  AND NOT EXISTS (SELECT 1 FROM "RegistroJornada" r WHERE r."motoristaId" = m."id");
