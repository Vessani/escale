-- Cliente.numeroSap: identificador estável do SAP, substitui o nome como
-- chave de correspondência de Integracao/Viagem.integracaoExigida. Tabela
-- Cliente está vazia em produção agora, então a coluna nasce NOT NULL sem
-- precisar de backfill.
ALTER TABLE "Cliente" ADD COLUMN "numeroSap" VARCHAR(20) NOT NULL;

CREATE INDEX "Cliente_numeroSap_idx" ON "Cliente"("numeroSap");
CREATE UNIQUE INDEX "Cliente_numeroSap_ativa_key" ON "Cliente"("numeroSap") WHERE "deletadoEm" IS NULL;
