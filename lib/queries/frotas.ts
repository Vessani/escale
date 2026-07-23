import { prisma } from "@/lib/prisma";

export async function buscarFrotas() {
  return await prisma.frota.findMany({
    where: { deletadoEm: null },
    orderBy: { cavalo: "asc" },
  });
}

export async function buscarFrotaPorId(id: number) {
  return await prisma.frota.findFirst({
    where: { id, deletadoEm: null },
  });
}
