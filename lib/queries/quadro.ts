import { prisma } from "@/lib/prisma";

/** Quadro de observações do Dashboard: bloco único por filial, sem histórico. */
export async function buscarQuadroObservacoes(filialId: number): Promise<string> {
  const quadro = await prisma.quadroObservacao.findUnique({ where: { filialId } });
  return quadro?.texto ?? "";
}
