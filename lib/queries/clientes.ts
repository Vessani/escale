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
 * Nome normalizado (trim + maiúsculas, mesmo critério de normalizarCliente
 * em alocacao.service.ts) → número SAP, só dos clientes que exigem
 * integração do motorista. O casamento com a entrega continua sendo pelo
 * nome (Entrega.cliente é texto livre, sem FK pro cadastro de Cliente — ver
 * comentário no schema), mas o valor propagado agora é o SAP, não o nome:
 * nomes são digitados de forma inconsistente, o SAP é a chave estável.
 * Substitui a antiga lista fixa CLIENTES_COM_INTEGRACAO_OBRIGATORIA.
 */
export async function buscarClientesQueExigemIntegracaoPorNome(): Promise<Map<string, string>> {
  const clientes = await prisma.cliente.findMany({
    where: { deletadoEm: null, exigeIntegracao: true },
    select: { nome: true, numeroSap: true },
  });

  return new Map(clientes.map((cliente) => [cliente.nome.trim().toUpperCase(), cliente.numeroSap]));
}
