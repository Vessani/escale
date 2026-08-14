-- Multi-tenant por filial: cada filial passa a ter seus próprios motoristas,
-- viagens, frotas e quadro de observações, sem visão cruzada entre filiais.
-- Cria a tabela Filial, faz backfill de todos os dados atuais para uma única
-- filial existente, e só então torna filialId obrigatório em
-- Motorista/Viagem/Frota (Usuario.filialId fica nulável — só SUPERADMIN, que
-- não pertence a nenhuma filial, tem esse campo nulo).

-- 1. Tabela Filial
CREATE TABLE "Filial" (
    "id" SERIAL NOT NULL,
    "nome" VARCHAR(100) NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Filial_pkey" PRIMARY KEY ("id")
);

INSERT INTO "Filial" ("nome") VALUES ('Filial Principal');

-- 2. Usuario: filialId nulável, backfill do(s) usuário(s) existente(s)
ALTER TABLE "Usuario" ADD COLUMN "filialId" INTEGER;
UPDATE "Usuario" SET "filialId" = (SELECT "id" FROM "Filial" WHERE "nome" = 'Filial Principal');
ALTER TABLE "Usuario" ADD CONSTRAINT "Usuario_filialId_fkey" FOREIGN KEY ("filialId") REFERENCES "Filial"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 3. Bootstrap do primeiro SUPERADMIN — sem filial, único jeito de acessar
-- /admin e cadastrar a 2ª filial pela UI. Senha temporária hasheada com
-- bcrypt; troca exige acesso direto ao banco por enquanto (sem tela própria).
INSERT INTO "Usuario" ("id", "nome", "email", "senha", "role", "filialId")
VALUES (
    'cm812superadmin0000001',
    'Super Admin',
    'superadmin@escala.local',
    '$2b$10$l75w5BIta2E5D1HqGyZQm..p4/69fNiMDw0B3rVh8hgn3BCSCRWkq',
    'SUPERADMIN',
    NULL
);

-- 4. Motorista: filialId obrigatório, backfill, índice
ALTER TABLE "Motorista" ADD COLUMN "filialId" INTEGER;
UPDATE "Motorista" SET "filialId" = (SELECT "id" FROM "Filial" WHERE "nome" = 'Filial Principal');
ALTER TABLE "Motorista" ALTER COLUMN "filialId" SET NOT NULL;
ALTER TABLE "Motorista" ADD CONSTRAINT "Motorista_filialId_fkey" FOREIGN KEY ("filialId") REFERENCES "Filial"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "Motorista_filialId_idx" ON "Motorista"("filialId");

-- 5. Frota: filialId obrigatório, backfill, índice, unicidade parcial refeita por filial
ALTER TABLE "Frota" ADD COLUMN "filialId" INTEGER;
UPDATE "Frota" SET "filialId" = (SELECT "id" FROM "Filial" WHERE "nome" = 'Filial Principal');
ALTER TABLE "Frota" ALTER COLUMN "filialId" SET NOT NULL;
ALTER TABLE "Frota" ADD CONSTRAINT "Frota_filialId_fkey" FOREIGN KEY ("filialId") REFERENCES "Filial"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "Frota_filialId_idx" ON "Frota"("filialId");

DROP INDEX IF EXISTS "Frota_cavalo_carreta_ativa_key";
CREATE UNIQUE INDEX "Frota_filialId_cavalo_carreta_ativa_key" ON "Frota"("filialId", "cavalo", "carreta") WHERE "deletadoEm" IS NULL;

-- 6. Viagem: filialId obrigatório, backfill, índice, unicidade parcial refeita por filial
ALTER TABLE "Viagem" ADD COLUMN "filialId" INTEGER;
UPDATE "Viagem" SET "filialId" = (SELECT "id" FROM "Filial" WHERE "nome" = 'Filial Principal');
ALTER TABLE "Viagem" ALTER COLUMN "filialId" SET NOT NULL;
ALTER TABLE "Viagem" ADD CONSTRAINT "Viagem_filialId_fkey" FOREIGN KEY ("filialId") REFERENCES "Filial"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "Viagem_filialId_idx" ON "Viagem"("filialId");

DROP INDEX IF EXISTS "Viagem_numViagem_ativa_key";
CREATE UNIQUE INDEX "Viagem_filialId_numViagem_ativa_key" ON "Viagem"("filialId", "numViagem") WHERE "deletadoEm" IS NULL;

-- 7. QuadroObservacao: um registro por filial (era um singleton fixo em id=1)
ALTER TABLE "QuadroObservacao" ADD COLUMN "filialId" INTEGER;
UPDATE "QuadroObservacao" SET "filialId" = (SELECT "id" FROM "Filial" WHERE "nome" = 'Filial Principal');
ALTER TABLE "QuadroObservacao" ALTER COLUMN "filialId" SET NOT NULL;
ALTER TABLE "QuadroObservacao" ADD CONSTRAINT "QuadroObservacao_filialId_key" UNIQUE ("filialId");
ALTER TABLE "QuadroObservacao" ADD CONSTRAINT "QuadroObservacao_filialId_fkey" FOREIGN KEY ("filialId") REFERENCES "Filial"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- 8. RLS na tabela nova — mesmo hardening das demais (ver migration
-- 20260707193000_enable_rls_all_tables); não afeta a aplicação, que conecta
-- via Prisma como dono das tabelas.
ALTER TABLE "Filial" ENABLE ROW LEVEL SECURITY;
