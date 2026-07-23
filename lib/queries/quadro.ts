import { prisma } from "@/lib/prisma";

/** Quadro de observações do Dashboard: bloco único e compartilhado (sempre id 1), sem histórico. */
export async function buscarQuadroObservacoes(): Promise<string> {
  const quadro = await prisma.quadroObservacao.findUnique({ where: { id: 1 } });
  return quadro?.texto ?? "";
}
