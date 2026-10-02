-- Acesso do motorista (login SEVA + PIN) e boletim da viagem preenchido por
-- ele: km inicial/final e despesas (pedágio, pernoite).

-- CreateEnum
CREATE TYPE "TipoDespesaViagem" AS ENUM ('PEDAGIO', 'PERNOITE');

-- AlterTable
ALTER TABLE "Usuario" ADD COLUMN "motoristaId" INTEGER;

-- AlterTable
ALTER TABLE "Viagem" ADD COLUMN "kmInicial" INTEGER,
ADD COLUMN "kmFinal" INTEGER;

-- CreateTable
CREATE TABLE "DespesaViagem" (
    "id" SERIAL NOT NULL,
    "viagemId" INTEGER NOT NULL,
    "tipo" "TipoDespesaViagem" NOT NULL,
    "valorCentavos" INTEGER NOT NULL,
    "registradoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "usuarioId" TEXT,
    "deletadoEm" TIMESTAMP(3),

    CONSTRAINT "DespesaViagem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DespesaViagem_viagemId_idx" ON "DespesaViagem"("viagemId");

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_motoristaId_key" ON "Usuario"("motoristaId");

-- AddForeignKey
ALTER TABLE "Usuario" ADD CONSTRAINT "Usuario_motoristaId_fkey" FOREIGN KEY ("motoristaId") REFERENCES "Motorista"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DespesaViagem" ADD CONSTRAINT "DespesaViagem_viagemId_fkey" FOREIGN KEY ("viagemId") REFERENCES "Viagem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
