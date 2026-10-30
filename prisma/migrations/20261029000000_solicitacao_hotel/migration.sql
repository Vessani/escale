-- Pedido de hotel pro pernoite, aprovado pelo gestor por link no grupo da filial (ver model SolicitacaoHotel).

-- CreateEnum
CREATE TYPE "StatusHotel" AS ENUM ('PENDENTE', 'APROVADO', 'RECUSADO', 'CANCELADO');

-- CreateTable
CREATE TABLE "SolicitacaoHotel" (
    "id" SERIAL NOT NULL,
    "filialId" INTEGER NOT NULL,
    "motoristaId" INTEGER NOT NULL,
    "viagemId" INTEGER,
    "cidade" VARCHAR(100) NOT NULL,
    "nomeHotel" VARCHAR(150) NOT NULL,
    "dataPernoite" DATE NOT NULL,
    "status" "StatusHotel" NOT NULL DEFAULT 'PENDENTE',
    "tokenHash" VARCHAR(64) NOT NULL,
    "expiraEm" TIMESTAMP(6) NOT NULL,
    "solicitadoPorId" TEXT,
    "solicitadoPorNome" TEXT,
    "pedidoPeloMotorista" BOOLEAN NOT NULL DEFAULT false,
    "decididoEm" TIMESTAMP(6),
    "decididoPorNome" VARCHAR(80),
    "observacaoGestor" VARCHAR(300),
    "decisaoIp" VARCHAR(100),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SolicitacaoHotel_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SolicitacaoHotel_tokenHash_key" ON "SolicitacaoHotel"("tokenHash");
CREATE INDEX "SolicitacaoHotel_filialId_criadoEm_idx" ON "SolicitacaoHotel"("filialId", "criadoEm");
CREATE INDEX "SolicitacaoHotel_motoristaId_idx" ON "SolicitacaoHotel"("motoristaId");
CREATE INDEX "SolicitacaoHotel_viagemId_idx" ON "SolicitacaoHotel"("viagemId");

-- AddForeignKey
ALTER TABLE "SolicitacaoHotel" ADD CONSTRAINT "SolicitacaoHotel_filialId_fkey" FOREIGN KEY ("filialId") REFERENCES "Filial"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SolicitacaoHotel" ADD CONSTRAINT "SolicitacaoHotel_motoristaId_fkey" FOREIGN KEY ("motoristaId") REFERENCES "Motorista"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SolicitacaoHotel" ADD CONSTRAINT "SolicitacaoHotel_viagemId_fkey" FOREIGN KEY ("viagemId") REFERENCES "Viagem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- No Supabase, tabela sem RLS fica aberta pela API REST pública (ver
-- prisma/migrations-rls.test.ts). O app acessa pelo Prisma, dono da tabela.
ALTER TABLE "SolicitacaoHotel" ENABLE ROW LEVEL SECURITY;
