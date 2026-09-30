-- Limpa os avisos "Frota indisponível" gravados pela regra antiga, que
-- comparava com Frota.disponivelEm (o maior fim previsto entre as viagens
-- ativas da carreta, INCLUINDO a própria) — editar uma viagem a fazia
-- conflitar consigo mesma. A regra nova (avaliarAvisoFrotaIndisponivel)
-- só avisa quando OUTRA viagem ativa da carreta se sobrepõe, ou quando a
-- frota está em manutenção; sem isso, o aviso falso só sumiria quando cada
-- viagem fosse salva de novo.
--
-- Só remove avisos de viagens em aberto sem nenhuma sobreposição real e
-- sem manutenção — os que continuam valendo ficam como estão e são
-- reescritos com o texto novo na próxima gravação da carreta.
UPDATE "Viagem" AS v
SET "avisoFrotaIndisponivel" = NULL
WHERE v."avisoFrotaIndisponivel" IS NOT NULL
  AND v."deletadoEm" IS NULL
  AND v."status" NOT IN ('CANCELADA', 'FINALIZADA')
  AND NOT EXISTS (
    SELECT 1 FROM "Viagem" AS outra
    WHERE outra."filialId" = v."filialId"
      AND outra."carreta" = v."carreta"
      AND outra."id" <> v."id"
      AND outra."deletadoEm" IS NULL
      AND outra."status" NOT IN ('CANCELADA', 'FINALIZADA')
      AND outra."inicioPrevisto" < v."fimPrevisto"
      AND outra."fimPrevisto" > v."inicioPrevisto"
  )
  AND NOT EXISTS (
    SELECT 1 FROM "Frota" AS f
    WHERE f."filialId" = v."filialId"
      AND f."carreta" = v."carreta"
      AND f."deletadoEm" IS NULL
      AND f."emManutencao" = true
  );
