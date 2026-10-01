-- Viagens postergadas guardavam o turno de antes de mudar de horário (ex:
-- era da noite, foi pra manhã e continuava NOITE), e a alocação procurava
-- motorista do turno errado. Daqui pra frente postergar recalcula o turno
-- (ver turnoPorHorario); isto acerta as que já estão em aberto.
-- inicioPrevisto é gravado em UTC; Brasília = UTC-3. 16:00 ou depois = NOITE.
UPDATE "Viagem"
SET "turno" = CASE WHEN EXTRACT(HOUR FROM "inicioPrevisto" - INTERVAL '3 hours') >= 16 THEN 'NOITE'::"Turno" ELSE 'MANHA'::"Turno" END
WHERE "status" = 'POSTERGADA'
  AND "deletadoEm" IS NULL
  AND "turno" <> CASE WHEN EXTRACT(HOUR FROM "inicioPrevisto" - INTERVAL '3 hours') >= 16 THEN 'NOITE'::"Turno" ELSE 'MANHA'::"Turno" END;
