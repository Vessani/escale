-- Pedido de Uber aprovado pelo gestor por link no grupo da filial (ver model SolicitacaoUber).

-- CreateEnum
CREATE TYPE "StatusUber" AS ENUM ('PENDENTE', 'APROVADO', 'RECUSADO', 'CANCELADO');
CREATE TYPE "MotivoUber" AS ENUM ('PERNOITE', 'MANUTENCAO', 'BUSCAR_FROTA', 'RENDER_MOTORISTA');

-- CreateTable
CREATE TABLE "SolicitacaoUber" (
    "id" SERIAL NOT NULL,
    "filialId" INTEGER NOT NULL,
    "motoristaId" INTEGER NOT NULL,
    "viagemId" INTEGER,
    "origem" VARCHAR(150) NOT NULL,
    "destino" VARCHAR(150) NOT NULL,
    "motivo" "MotivoUber" NOT NULL,
    "status" "StatusUber" NOT NULL DEFAULT 'PENDENTE',
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

    CONSTRAINT "SolicitacaoUber_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SolicitacaoUber_tokenHash_key" ON "SolicitacaoUber"("tokenHash");
CREATE INDEX "SolicitacaoUber_filialId_criadoEm_idx" ON "SolicitacaoUber"("filialId", "criadoEm");
CREATE INDEX "SolicitacaoUber_motoristaId_idx" ON "SolicitacaoUber"("motoristaId");
CREATE INDEX "SolicitacaoUber_viagemId_idx" ON "SolicitacaoUber"("viagemId");

-- AddForeignKey
ALTER TABLE "SolicitacaoUber" ADD CONSTRAINT "SolicitacaoUber_filialId_fkey" FOREIGN KEY ("filialId") REFERENCES "Filial"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SolicitacaoUber" ADD CONSTRAINT "SolicitacaoUber_motoristaId_fkey" FOREIGN KEY ("motoristaId") REFERENCES "Motorista"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SolicitacaoUber" ADD CONSTRAINT "SolicitacaoUber_viagemId_fkey" FOREIGN KEY ("viagemId") REFERENCES "Viagem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- No Supabase, tabela sem RLS fica aberta pela API REST pública (ver
-- prisma/migrations-rls.test.ts). O app acessa pelo Prisma, dono da tabela.
ALTER TABLE "SolicitacaoUber" ENABLE ROW LEVEL SECURITY;
