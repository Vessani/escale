-- CreateIndex
-- Suporta a checagem de disponibilidade de frota (ver frota.service.ts), que
-- filtra Viagem por cavalo/carreta a cada criação/edição.
CREATE INDEX "Viagem_cavalo_idx" ON "Viagem"("cavalo");

-- CreateIndex
CREATE INDEX "Viagem_carreta_idx" ON "Viagem"("carreta");
