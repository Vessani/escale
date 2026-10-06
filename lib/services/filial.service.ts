import { prisma } from "@/lib/prisma"
import type { FilialFormValues } from "@/lib/validation/filiais"
import { registrarAuditoria, type Ator } from "./auditoria.service"

export async function criarFilialService(dados: FilialFormValues, ator: Ator | null) {
  return prisma.$transaction(async (tx) => {
    const criada = await tx.filial.create({ data: dados })
    await registrarAuditoria(tx, { entidade: "Filial", entidadeId: criada.id, acao: "CRIACAO", depois: criada, ator, filialId: criada.id })
    return criada
  })
}
