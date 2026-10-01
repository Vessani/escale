import { prisma } from "@/lib/prisma";

export async function buscarFrotas(filialId: number) {
  return await prisma.frota.findMany({
    where: { deletadoEm: null, filialId },
    orderBy: { cavalo: "asc" },
  });
}

export async function buscarFrotaPorId(filialId: number, id: number) {
  return await prisma.frota.findFirst({
    where: { id, filialId, deletadoEm: null },
  });
}

/** Produto de cada carreta cadastrada (a do conjunto mais recente, se houver mais de um). */
export async function buscarProdutoPorCarreta(filialId: number, carretas: string[]) {
  const frotas = await prisma.frota.findMany({
    where: { filialId, deletadoEm: null, carreta: { in: [...new Set(carretas)] }, tipoProduto: { not: null } },
    orderBy: { atualizadoEm: "desc" },
    select: { carreta: true, tipoProduto: true },
  });
  const mapa = new Map<string, NonNullable<(typeof frotas)[number]["tipoProduto"]>>();
  for (const frota of frotas) {
    if (frota.tipoProduto && !mapa.has(frota.carreta)) mapa.set(frota.carreta, frota.tipoProduto);
  }
  return mapa;
}
