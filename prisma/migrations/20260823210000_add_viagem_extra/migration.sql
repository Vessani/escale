-- Marca uma viagem criada depois que a programação já saiu pra operação —
-- não é um status (convive com qualquer status do fluxo normal). Ver
-- comentário no model Viagem.
ALTER TABLE "Viagem" ADD COLUMN "viagemExtra" BOOLEAN NOT NULL DEFAULT false;
