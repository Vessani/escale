import { prisma } from "@/lib/prisma"

/** Histórico de um registro específico — painel "Histórico" na tela de edição. */
export async function buscarHistoricoDaEntidade(entidade: string, entidadeId: number | string) {
  return prisma.registroAuditoria.findMany({
    where: { entidade, entidadeId: String(entidadeId) },
    orderBy: { criadoEm: "desc" },
  })
}

/** Feed cronológico de tudo que mudou numa filial dentro de um período — tela /historico. */
export async function buscarHistoricoDoDia(filialId: number, de: Date, ate: Date) {
  return prisma.registroAuditoria.findMany({
    where: { filialId, criadoEm: { gte: de, lte: ate } },
    orderBy: { criadoEm: "desc" },
  })
}
