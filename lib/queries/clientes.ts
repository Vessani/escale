import { prisma } from "@/lib/prisma";

export async function buscarClientes() {
  return await prisma.cliente.findMany({
    where: { deletadoEm: null },
    orderBy: { nome: "asc" },
  });
}

export async function buscarClientePorId(id: number) {
  return await prisma.cliente.findFirst({
    where: { id, deletadoEm: null },
  });
}

/**
 * Nomes (já normalizados — trim + maiúsculas, mesmo critério de
 * normalizarCliente em alocacao.service.ts) dos clientes que exigem
 * integração do motorista. Substitui a antiga lista fixa
 * CLIENTES_COM_INTEGRACAO_OBRIGATORIA.
 */
export async function buscarNomesClientesQueExigemIntegracao(): Promise<Set<string>> {
  const clientes = await prisma.cliente.findMany({
    where: { deletadoEm: null, exigeIntegracao: true },
    select: { nome: true },
  });

  return new Set(clientes.map((cliente) => cliente.nome.trim().toUpperCase()));
}
