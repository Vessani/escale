-- Troca de motorista no meio da viagem.

-- CreateTable
CREATE TABLE "TrocaMotorista" (
    "id" SERIAL NOT NULL,
    "viagemId" INTEGER NOT NULL,
    "motoristaAnteriorId" INTEGER NOT NULL,
    "motoristaNovoId" INTEGER NOT NULL,
    "km" INTEGER NOT NULL,
    "trocadoEm" TIMESTAMP(3) NOT NULL,
    "local" VARCHAR(100) NOT NULL,
    "motivo" VARCHAR(200) NOT NULL,
    "usuarioId" TEXT,
    "registradoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrocaMotorista_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TrocaMotorista_viagemId_idx" ON "TrocaMotorista"("viagemId");
CREATE INDEX "TrocaMotorista_motoristaAnteriorId_idx" ON "TrocaMotorista"("motoristaAnteriorId");
CREATE INDEX "TrocaMotorista_motoristaNovoId_idx" ON "TrocaMotorista"("motoristaNovoId");

-- AddForeignKey
ALTER TABLE "TrocaMotorista" ADD CONSTRAINT "TrocaMotorista_viagemId_fkey" FOREIGN KEY ("viagemId") REFERENCES "Viagem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TrocaMotorista" ADD CONSTRAINT "TrocaMotorista_motoristaAnteriorId_fkey" FOREIGN KEY ("motoristaAnteriorId") REFERENCES "Motorista"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TrocaMotorista" ADD CONSTRAINT "TrocaMotorista_motoristaNovoId_fkey" FOREIGN KEY ("motoristaNovoId") REFERENCES "Motorista"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
