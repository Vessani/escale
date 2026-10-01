-- Usuário desativável (ver callbacks.jwt em lib/auth.ts) e registro de
-- tentativas de login que falharam (limite de tentativas, ver
-- lib/services/login.service.ts). Só acrescenta — nada que a versão
-- anterior do app use muda.
ALTER TABLE "Usuario" ADD COLUMN "ativo" BOOLEAN NOT NULL DEFAULT true;

CREATE TABLE "TentativaLogin" (
    "id" SERIAL NOT NULL,
    "email" VARCHAR(200) NOT NULL,
    "ip" VARCHAR(100),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TentativaLogin_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "TentativaLogin_email_criadoEm_idx" ON "TentativaLogin"("email", "criadoEm");
CREATE INDEX "TentativaLogin_ip_criadoEm_idx" ON "TentativaLogin"("ip", "criadoEm");

-- Mesmo padrão das demais tabelas (migration 20260707193000_enable_rls_all_tables):
-- RLS ligado e sem política, pra ninguém acessar pela API pública do Supabase.
ALTER TABLE "TentativaLogin" ENABLE ROW LEVEL SECURITY;
