-- CreateIndex
CREATE INDEX "Viagem_motoristaId_idx" ON "Viagem"("motoristaId");

-- CreateIndex
CREATE INDEX "Viagem_status_idx" ON "Viagem"("status");

-- CreateIndex
CREATE INDEX "Viagem_inicioPrevisto_fimPrevisto_idx" ON "Viagem"("inicioPrevisto", "fimPrevisto");
