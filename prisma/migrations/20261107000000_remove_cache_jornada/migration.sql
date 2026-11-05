-- Só depois do deploy que parou de ler e gravar estas colunas: a migration roda
-- antes do build, com o código anterior ainda no ar. O código de jornada vem do
-- RegistroJornada, e os horários por dia também (ver situacaoDoDia).
ALTER TABLE "Motorista"
  DROP COLUMN "diasTrabalhados",
  DROP COLUMN "jornadaRelatorioFim",
  DROP COLUMN "jornadaRelatorioDia";
