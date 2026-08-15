-- Horário real de início/fim da jornada nesse dia específico, vindo do
-- Relatório Sintético de Jornada (ver jornada-relatorio.service.ts). Nulo
-- para linhas criadas por edição manual do calendário, cadastro de
-- motorista ou reconciliação de folga — só o import de jornada preenche.
ALTER TABLE "RegistroJornada" ADD COLUMN "inicioJornada" TIMESTAMP(6),
ADD COLUMN "fimJornada" TIMESTAMP(6);
