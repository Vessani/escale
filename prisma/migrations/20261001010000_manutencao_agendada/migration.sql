-- Manutenção agendada por veículo (cavalo ou carreta), no lugar do
-- liga/desliga "Em manutenção" do cadastro de frota.
CREATE TYPE "VeiculoManutencao" AS ENUM ('CAVALO', 'CARRETA');
CREATE TYPE "TipoManutencao" AS ENUM ('PREVENTIVA', 'CORRETIVA');
CREATE TYPE "NivelPreventiva" AS ENUM ('A', 'B', 'C', 'D');
CREATE TYPE "ResponsavelManutencao" AS ENUM ('WHITE_MARTINS', 'RITMO');

CREATE TABLE "Manutencao" (
    "id" SERIAL NOT NULL,
    "filialId" INTEGER NOT NULL,
    "veiculo" "VeiculoManutencao" NOT NULL,
    "codigo" VARCHAR(7) NOT NULL,
    "tipo" "TipoManutencao" NOT NULL,
    "nivel" "NivelPreventiva",
    "responsavel" "ResponsavelManutencao" NOT NULL,
    "descricao" VARCHAR(500),
    "inicioPrevisto" TIMESTAMP(6) NOT NULL,
    "fimPrevisto" TIMESTAMP(6),
    "inicioReal" TIMESTAMP(6),
    "fimReal" TIMESTAMP(6),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,
    "deletadoEm" TIMESTAMP(3),

    CONSTRAINT "Manutencao_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Manutencao_filialId_veiculo_codigo_idx" ON "Manutencao"("filialId", "veiculo", "codigo");
CREATE INDEX "Manutencao_filialId_inicioPrevisto_idx" ON "Manutencao"("filialId", "inicioPrevisto");

ALTER TABLE "Manutencao" ADD CONSTRAINT "Manutencao_filialId_fkey" FOREIGN KEY ("filialId") REFERENCES "Filial"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Manutencao" ENABLE ROW LEVEL SECURITY;

-- Quem estava marcado "Em manutenção" vira uma manutenção corretiva em
-- aberto, na carreta (é ela que identifica o conjunto), desde a última
-- alteração do cadastro e sem fim previsto — continua parado até alguém
-- concluir, como era antes.
INSERT INTO "Manutencao" ("filialId", "veiculo", "codigo", "tipo", "responsavel", "descricao", "inicioPrevisto", "inicioReal", "atualizadoEm")
SELECT "filialId", 'CARRETA', "carreta", 'CORRETIVA', 'RITMO',
       'Conjunto ' || "cavalo" || '/' || "carreta" || ' estava marcado como "Em manutenção" no cadastro. Confira veículo, responsável e previsão.',
       "atualizadoEm", "atualizadoEm", CURRENT_TIMESTAMP
FROM "Frota"
WHERE "emManutencao" = true AND "deletadoEm" IS NULL;

-- emManutencao fica como está (nenhum código novo lê): durante o deploy, a
-- versão anterior ainda no ar continua vendo o conjunto parado.
