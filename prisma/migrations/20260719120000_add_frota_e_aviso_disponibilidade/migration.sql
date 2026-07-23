-- AlterTable
ALTER TABLE "Viagem" ADD COLUMN "avisoFrotaIndisponivel" VARCHAR(200);

-- CreateTable
-- Catálogo de frotas (cavalo/carreta) já vistas em viagens, populado
-- automaticamente. Disponibilidade não é armazenada aqui: é sempre calculada
-- na hora a partir das viagens ativas de cada código (ver frota.service.ts).
CREATE TABLE "Frota" (
    "id" SERIAL NOT NULL,
    "codigo" VARCHAR(7) NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Frota_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Frota_codigo_key" ON "Frota"("codigo");

-- Segue o mesmo padrão de segurança já aplicado às demais tabelas públicas.
ALTER TABLE "Frota" ENABLE ROW LEVEL SECURITY;
