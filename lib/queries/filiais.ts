import { prisma } from "@/lib/prisma";

export async function buscarFiliais() {
  return await prisma.filial.findMany({ orderBy: { nome: "asc" } });
}

/** Nome da filial, pro cabeçalho das planilhas. */
export async function buscarNomeFilial(filialId: number): Promise<string | null> {
  const filial = await prisma.filial.findUnique({ where: { id: filialId }, select: { nome: true } })
  return filial?.nome ?? null
}
