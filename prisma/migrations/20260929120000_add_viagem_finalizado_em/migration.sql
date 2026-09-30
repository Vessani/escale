-- AlterTable
-- Instante em que a viagem foi marcada como FINALIZADA. A partir dele o
-- motorista é considerado livre (o descanso mínimo de 11h/35h conta desde
-- aqui, se for antes do fim previsto). Nulo nas viagens finalizadas antes
-- desta coluna existir — essas continuam usando o fim previsto.
ALTER TABLE "Viagem" ADD COLUMN "finalizadoEm" TIMESTAMP(6);
