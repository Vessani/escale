import { prisma } from "@/lib/prisma"

/** Tudo da viagem pro "Relatório da viagem" — null se não for da filial. */
/** comHistorico: só a gerência vê a linha do tempo, que sai do histórico de alterações. */
export async function buscarRelatorioViagem(filialId: number, viagemId: number, comHistorico: boolean) {
  const viagem = await prisma.viagem.findFirst({
    where: { id: viagemId, filialId, deletadoEm: null },
    include: {
      motorista: { select: { nome: true } },
      motoristaAcompanhante: { select: { nome: true } },
      entregas: { orderBy: { id: "asc" }, include: { chegada: true } },
      despesas: { where: { deletadoEm: null }, orderBy: { registradoEm: "asc" } },
      trocas: {
        orderBy: { trocadoEm: "asc" },
        include: { motoristaAnterior: { select: { nome: true } }, motoristaNovo: { select: { nome: true } } },
      },
    },
  })
  if (!viagem) return null

  const historico = comHistorico
    ? await prisma.registroAuditoria.findMany({
        where: { entidade: "Viagem", entidadeId: String(viagemId) },
        orderBy: { criadoEm: "asc" },
        select: { criadoEm: true, antes: true, depois: true, usuarioNome: true },
      })
    : null
  return { viagem, historico }
}
