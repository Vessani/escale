-- "Dias Sem Folga" real do relatório de jornada, sem o limite de 6 do código
-- do calendário — 7 ou mais = folga estourada. Preenchido a partir do
-- próximo import (o valor real dos imports anteriores não foi guardado).
ALTER TABLE "RegistroJornada" ADD COLUMN "diasSemFolga" INTEGER;
