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
