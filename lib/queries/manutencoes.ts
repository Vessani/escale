import { prisma } from "@/lib/prisma"

const UM_DIA_MS = 24 * 60 * 60 * 1000

/**
 * Manutenções da tela: todas as em aberto (agendadas, em andamento,
 * passadas da previsão) e as concluídas nos últimos `diasConcluidas` dias.
 */
export async function buscarManutencoes(filialId: number, diasConcluidas = 30, agora = new Date()) {
  return prisma.manutencao.findMany({
    where: {
      filialId,
      deletadoEm: null,
      OR: [{ fimReal: null }, { fimReal: { gte: new Date(agora.getTime() - diasConcluidas * UM_DIA_MS) } }],
    },
    orderBy: [{ inicioPrevisto: "asc" }],
  })
}

/** Em aberto (não concluídas) — pra situação dos conjuntos na tela de Frotas. */
export async function buscarManutencoesEmAberto(filialId: number) {
  return prisma.manutencao.findMany({ where: { filialId, deletadoEm: null, fimReal: null } })
}

export async function buscarManutencaoPorId(filialId: number, id: number) {
  return prisma.manutencao.findFirst({ where: { id, filialId, deletadoEm: null } })
}

/** Códigos de cavalos e carretas cadastrados (sugestões do formulário e nome do conjunto na lista). */
export async function buscarVeiculosCadastrados(filialId: number) {
  const frotas = await prisma.frota.findMany({
    where: { filialId, deletadoEm: null },
    select: { cavalo: true, carreta: true },
    orderBy: { cavalo: "asc" },
  })
  return frotas
}
