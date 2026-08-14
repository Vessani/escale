-- Cadastro de clientes, com a flag "exige integração" substituindo a lista
-- fixa que existia no código (CLIENTES_COM_INTEGRACAO_OBRIGATORIA em
-- alocacao.service.ts). Global (sem filialId) — clientes como AMBEV/WEG
-- podem ser atendidos por mais de uma filial.
CREATE TABLE "Cliente" (
    "id" SERIAL NOT NULL,
    "nome" VARCHAR(100) NOT NULL,
    "exigeIntegracao" BOOLEAN NOT NULL DEFAULT false,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,
    "deletadoEm" TIMESTAMP(3),
    CONSTRAINT "Cliente_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Cliente_nome_idx" ON "Cliente"("nome");

ALTER TABLE "Cliente" ENABLE ROW LEVEL SECURITY;

-- Seed com os dois clientes que hoje exigem integração no código, pra não
-- regredir o comportamento atual.
INSERT INTO "Cliente" ("nome", "exigeIntegracao", "atualizadoEm") VALUES
    ('GEMP - AMBEV - BEBIDAS - N2L. (GRUPO AMB', true, CURRENT_TIMESTAMP),
    ('WEG', true, CURRENT_TIMESTAMP);
