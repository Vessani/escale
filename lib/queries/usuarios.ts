import { prisma } from "@/lib/prisma";

export async function buscarUsuarios() {
  return await prisma.usuario.findMany({
    orderBy: [{ ativo: "desc" }, { nome: "asc" }],
    select: {
      id: true,
      nome: true,
      email: true,
      role: true,
      ativo: true,
      filialId: true,
      filial: { select: { nome: true } },
    },
  });
}
