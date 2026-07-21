-- AlterTable
ALTER TABLE "Viagem" ADD COLUMN "avisoInterjornada" VARCHAR(200);

-- AlterTable
ALTER TABLE "Motorista" ADD COLUMN "jornadaRelatorioInicio" TIMESTAMP(6),
ADD COLUMN "jornadaRelatorioFim" TIMESTAMP(6),
ADD COLUMN "jornadaRelatorioDia" DATE;

-- CreateIndex
CREATE INDEX "Motorista_seva_idx" ON "Motorista"("seva");
