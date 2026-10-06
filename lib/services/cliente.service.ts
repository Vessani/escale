import type { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { ErroDeDominio } from "@/lib/errors"
import type { ClienteFormValues } from "@/lib/validation/clientes"
import { registrarAuditoria, type Ator } from "./auditoria.service"

/**
 * Cadastro de clientes. Cliente é global (sem filial — ver o schema), então a
 * auditoria vai com filialId null. O "antes" é lido dentro da transação, com
 * a linha travada, pra auditoria registrar o estado que de fato mudou.
 */

async function buscarTravadoOuFalhar(tx: Prisma.TransactionClient, id: number) {
  await tx.$queryRaw`SELECT id FROM "Cliente" WHERE id = ${id} FOR UPDATE`
  const cliente = await tx.cliente.findFirst({ where: { id, deletadoEm: null } })
  if (!cliente) throw new ErroDeDominio("CLIENTE_NAO_ENCONTRADO", "Cliente não encontrado.")
  return cliente
}

export async function criarClienteService(dados: ClienteFormValues, ator: Ator | null) {
  return prisma.$transaction(async (tx) => {
    const criado = await tx.cliente.create({ data: dados })
    await registrarAuditoria(tx, { entidade: "Cliente", entidadeId: criado.id, acao: "CRIACAO", depois: criado, ator, filialId: null })
    return criado
  })
}

export async function editarClienteService(id: number, dados: ClienteFormValues, ator: Ator | null) {
  return prisma.$transaction(async (tx) => {
    const antes = await buscarTravadoOuFalhar(tx, id)
    const depois = await tx.cliente.update({ where: { id }, data: dados })
    await registrarAuditoria(tx, { entidade: "Cliente", entidadeId: id, acao: "ATUALIZACAO", antes, depois, ator, filialId: null })
    return depois
  })
}

/** Soft delete — viagens antigas continuam apontando pro cliente. */
export async function deletarClienteService(id: number, ator: Ator | null) {
  return prisma.$transaction(async (tx) => {
    const antes = await buscarTravadoOuFalhar(tx, id)
    const depois = await tx.cliente.update({ where: { id }, data: { deletadoEm: new Date() } })
    await registrarAuditoria(tx, { entidade: "Cliente", entidadeId: id, acao: "EXCLUSAO", antes, depois, ator, filialId: null })
    return depois
  })
}
