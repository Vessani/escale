import { prisma } from "@/lib/prisma"
import { registrarAuditoria, type Ator } from "./auditoria.service"

/**
 * Sobrescreve o texto do quadro de observações (um por filial). O histórico
 * das versões anteriores fica em RegistroAuditoria; o "antes" é lido na
 * mesma transação da gravação.
 */
export async function atualizarQuadroService(filialId: number, texto: string, ator: Ator | null) {
  return prisma.$transaction(async (tx) => {
    const antes = await tx.quadroObservacao.findUnique({ where: { filialId } })
    const depois = await tx.quadroObservacao.upsert({
      where: { filialId },
      create: { filialId, texto },
      update: { texto },
    })
    await registrarAuditoria(tx, {
      entidade: "QuadroObservacao",
      // Sem id próprio relevante pro usuário — usa filialId como chave estável.
      entidadeId: String(filialId),
      acao: antes ? "ATUALIZACAO" : "CRIACAO",
      antes,
      depois,
      ator,
      filialId,
    })
    return depois
  })
}
