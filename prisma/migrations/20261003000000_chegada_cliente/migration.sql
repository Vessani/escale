-- Chegada no cliente (km, hora, medição do descarregado) e problema mecânico
-- informados pelo motorista.

-- CreateEnum
CREATE TYPE "TipoMedicao" AS ENUM ('MANOMETRO', 'BALANCA');

-- AlterTable
ALTER TABLE "Viagem" ADD COLUMN "problemaMecanico" VARCHAR(300),
ADD COLUMN "problemaMecanicoEm" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "ChegadaEntrega" (
    "id" SERIAL NOT NULL,
    "entregaId" INTEGER NOT NULL,
    "km" INTEGER NOT NULL,
    "chegadaEm" TIMESTAMP(3) NOT NULL,
    "medicao" "TipoMedicao",
    "nivelInicial" DECIMAL(12,3) NOT NULL,
    "nivelFinal" DECIMAL(12,3) NOT NULL,
    "polInicial" DECIMAL(10,2),
    "polFinal" DECIMAL(10,2),
    "fator" DECIMAL(10,4),
    "totalDescarregado" DECIMAL(14,3) NOT NULL,
    "usuarioId" TEXT,
    "registradoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChegadaEntrega_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ChegadaEntrega_entregaId_key" ON "ChegadaEntrega"("entregaId");

-- AddForeignKey
ALTER TABLE "ChegadaEntrega" ADD CONSTRAINT "ChegadaEntrega_entregaId_fkey" FOREIGN KEY ("entregaId") REFERENCES "Entrega"("id") ON DELETE CASCADE ON UPDATE CASCADE;
