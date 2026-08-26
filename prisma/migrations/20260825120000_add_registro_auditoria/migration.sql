-- Log genérico de mudanças (criação/edição/exclusão) em qualquer entidade
-- mutável — a versão consultável do quadro branco que a operação apagava
-- todo dia. Ver comentário no model RegistroAuditoria.
CREATE TYPE "AcaoAuditoria" AS ENUM ('CRIACAO', 'ATUALIZACAO', 'EXCLUSAO');

CREATE TABLE "RegistroAuditoria" (
    "id" SERIAL NOT NULL,
    "entidade" VARCHAR(40) NOT NULL,
    "entidadeId" VARCHAR(30) NOT NULL,
    "acao" "AcaoAuditoria" NOT NULL,
    "antes" JSONB,
    "depois" JSONB,
    "usuarioId" TEXT,
    "usuarioNome" TEXT,
    "filialId" INTEGER,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RegistroAuditoria_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "RegistroAuditoria_entidade_entidadeId_criadoEm_idx" ON "RegistroAuditoria"("entidade", "entidadeId", "criadoEm");
CREATE INDEX "RegistroAuditoria_filialId_criadoEm_idx" ON "RegistroAuditoria"("filialId", "criadoEm");

ALTER TABLE "RegistroAuditoria" ENABLE ROW LEVEL SECURITY;
