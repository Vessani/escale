-- Estouro de jornada aprovado pelo gestor por link no grupo da filial (ver model EstouroJornada).

-- CreateEnum
CREATE TYPE "StatusEstouro" AS ENUM ('PENDENTE', 'APROVADO', 'RECUSADO', 'CANCELADO');
CREATE TYPE "MotivoEstouro" AS ENUM ('CLIENTE_PRIORITARIO', 'TRANSITO_LENTO', 'CHEGAR_HOTEL', 'CHEGAR_CLIENTE', 'CHEGAR_CDL', 'ABASTECER');

-- CreateTable
CREATE TABLE "EstouroJornada" (
    "id" SERIAL NOT NULL,
    "filialId" INTEGER NOT NULL,
    "motoristaId" INTEGER NOT NULL,
    "viagemId" INTEGER,
    "minutosExtras" INTEGER NOT NULL,
    "motivos" "MotivoEstouro"[],
    "status" "StatusEstouro" NOT NULL DEFAULT 'PENDENTE',
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

    CONSTRAINT "EstouroJornada_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EstouroJornada_tokenHash_key" ON "EstouroJornada"("tokenHash");
CREATE INDEX "EstouroJornada_filialId_criadoEm_idx" ON "EstouroJornada"("filialId", "criadoEm");
CREATE INDEX "EstouroJornada_motoristaId_idx" ON "EstouroJornada"("motoristaId");
CREATE INDEX "EstouroJornada_viagemId_idx" ON "EstouroJornada"("viagemId");

-- AddForeignKey
ALTER TABLE "EstouroJornada" ADD CONSTRAINT "EstouroJornada_filialId_fkey" FOREIGN KEY ("filialId") REFERENCES "Filial"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EstouroJornada" ADD CONSTRAINT "EstouroJornada_motoristaId_fkey" FOREIGN KEY ("motoristaId") REFERENCES "Motorista"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EstouroJornada" ADD CONSTRAINT "EstouroJornada_viagemId_fkey" FOREIGN KEY ("viagemId") REFERENCES "Viagem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- No Supabase, tabela sem RLS fica aberta pela API REST pública (ver
-- prisma/migrations-rls.test.ts). O app acessa pelo Prisma, dono da tabela.
ALTER TABLE "EstouroJornada" ENABLE ROW LEVEL SECURITY;
