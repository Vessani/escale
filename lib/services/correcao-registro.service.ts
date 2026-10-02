import { prisma } from "@/lib/prisma"
import { ErroDeDominio } from "@/lib/errors"
import { registrarAuditoria, type Ator } from "@/lib/services/auditoria.service"
import { CAMPO_CONTEXTO_AUDITORIA } from "@/lib/utils/diff-auditoria"

/**
 * Correção feita pelo escalador no que o motorista registrou. Por enquanto:
 * apagar uma chegada lançada no cliente errado — a entrega volta a poder ser
 * editada (ver trava-chegada.ts). O registro apagado fica no histórico.
 */
export async function apagarChegadaPeloEscalador(filialId: number, chegadaId: number, ator: Ator) {
  const chegada = await prisma.chegadaEntrega.findFirst({
    where: { id: chegadaId, entrega: { viagem: { filialId, deletadoEm: null } } },
    include: { entrega: { select: { cliente: true, viagemId: true, viagem: { select: { numViagem: true } } } } },
  })
  if (!chegada) throw new ErroDeDominio("CHEGADA_NAO_ENCONTRADA", "Chegada não encontrada nesta filial.")
  const { entrega, ...antes } = chegada

  await prisma.$transaction(async (tx) => {
    // Mesma trava do motorista e da edição: não apaga no meio de outra gravação.
    await tx.$queryRaw`SELECT id FROM "Viagem" WHERE id = ${entrega.viagemId} AND "filialId" = ${filialId} FOR UPDATE`
    await tx.chegadaEntrega.delete({ where: { id: chegadaId } })
    await registrarAuditoria(tx, {
      entidade: "ChegadaEntrega",
      entidadeId: chegadaId,
      acao: "EXCLUSAO",
      antes: { ...antes, [CAMPO_CONTEXTO_AUDITORIA]: `Chegada em ${entrega.cliente} (viagem ${entrega.viagem.numViagem})` },
      ator,
      filialId,
    })
  })
  return { viagemId: entrega.viagemId }
}
