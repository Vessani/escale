-- AlterTable
ALTER TABLE "Viagem"
  ADD COLUMN "canceladoEm" TIMESTAMP(6),
  ADD COLUMN "motoristaAcompanhanteId" INTEGER;

-- AlterTable
ALTER TABLE "Motorista" ADD COLUMN "liberado" BOOLEAN NOT NULL DEFAULT true;

-- CreateIndex
CREATE INDEX "Viagem_motoristaAcompanhanteId_idx" ON "Viagem"("motoristaAcompanhanteId");

-- AddForeignKey
ALTER TABLE "Viagem" ADD CONSTRAINT "Viagem_motoristaAcompanhanteId_fkey"
  FOREIGN KEY ("motoristaAcompanhanteId") REFERENCES "Motorista"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable
-- Bloco único de recados gerais da operação, editado no rodapé do Dashboard.
CREATE TABLE "QuadroObservacao" (
    "id" SERIAL NOT NULL,
    "texto" TEXT NOT NULL,
    "atualizadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuadroObservacao_pkey" PRIMARY KEY ("id")
);

-- Segue o mesmo padrão de segurança já aplicado às demais tabelas públicas.
ALTER TABLE "QuadroObservacao" ENABLE ROW LEVEL SECURITY;
