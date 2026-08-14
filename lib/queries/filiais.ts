import { prisma } from "@/lib/prisma";

export async function buscarFiliais() {
  return await prisma.filial.findMany({ orderBy: { nome: "asc" } });
}
