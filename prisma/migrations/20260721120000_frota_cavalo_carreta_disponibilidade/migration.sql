-- DropIndex
DROP INDEX "Frota_codigo_key";

-- AlterTable
-- Frota deixa de ser um catálogo de código único (auto-populado, disponibilidade
-- calculada na hora) e vira um cadastro de conjunto (cavalo + carreta — no caso de
-- truck, os dois com o mesmo número) com disponibilidade guardada. A tabela está
-- vazia em produção (só usada em testes até aqui), então não há dado a migrar.
ALTER TABLE "Frota"
  DROP COLUMN "codigo",
  ADD COLUMN "cavalo" VARCHAR(7) NOT NULL,
  ADD COLUMN "carreta" VARCHAR(7) NOT NULL,
  ADD COLUMN "disponivelEm" TIMESTAMP(6),
  ADD COLUMN "deletadoEm" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "Frota_cavalo_carreta_key" ON "Frota"("cavalo", "carreta");
CREATE INDEX "Frota_cavalo_idx" ON "Frota"("cavalo");
CREATE INDEX "Frota_carreta_idx" ON "Frota"("carreta");
