-- Produto: novo enum compartilhado por Viagem.produto (obrigatório só na
-- validação de formulário, coluna nula pra não quebrar histórico),
-- Frota.tipoProduto (um só por conjunto, dedicado) e
-- Motorista.produtosAutorizados (vários, certificações do condutor).
CREATE TYPE "TipoProduto" AS ENUM ('CO2', 'NITROGENIO', 'ARGONIO', 'BIOMETANO', 'OXIGENIO');

-- Nulo pra viagens já existentes — exigido só nos formulários novos (mesmo
-- espírito de Frota.emManutencao/disponivelEm).
ALTER TABLE "Viagem" ADD COLUMN "produto" "TipoProduto";
ALTER TABLE "Viagem" ADD COLUMN "avisoFrotaProdutoIncompativel" VARCHAR(200);

-- Nulo pras frotas já existentes.
ALTER TABLE "Frota" ADD COLUMN "tipoProduto" "TipoProduto";

-- CPF: nulo pros motoristas já cadastrados sem CPF (não são retroativamente
-- preenchidos) — exigido só no formulário de cadastro/edição daqui pra
-- frente (validação Zod, não constraint de banco). Índice único padrão do
-- Postgres permite múltiplos NULL, então não bloqueia os registros sem CPF
-- entre si.
ALTER TABLE "Motorista" ADD COLUMN "cpf" VARCHAR(11);
CREATE UNIQUE INDEX "Motorista_cpf_key" ON "Motorista"("cpf");

-- Produtos que o motorista está autorizado a transportar — array nativo
-- Postgres, sem tabela de junção; motorista pode ter mais de um.
ALTER TABLE "Motorista" ADD COLUMN "produtosAutorizados" "TipoProduto"[] NOT NULL DEFAULT '{}';
