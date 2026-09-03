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
 * Conjunto dos numeroSap dos clientes que exigem integração do motorista. O
 * casamento com a entrega é pelo SAP Code (Entrega.sapcode), não pelo nome —
 * o nome do cliente é digitado de forma inconsistente na entrega, enquanto o
 * SAP Code é a chave estável que também identifica o cliente no cadastro
 * (Cliente.numeroSap). Ver calcularIntegracaoExigida (alocacao/compatibilidade.ts).
 * Substitui a antiga lista fixa CLIENTES_COM_INTEGRACAO_OBRIGATORIA.
 */
export async function buscarNumerosSapQueExigemIntegracao(): Promise<Set<string>> {
  const clientes = await prisma.cliente.findMany({
    where: { deletadoEm: null, exigeIntegracao: true },
    select: { numeroSap: true },
  });

  return new Set(clientes.map((cliente) => cliente.numeroSap));
}
