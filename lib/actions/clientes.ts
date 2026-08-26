'use server'
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth-guard";
import { errorToMessage } from "@/lib/action-error";
import { clienteSchema, type ClienteFormValues } from "@/lib/validation/clientes";
import type { RespostaAcao } from "@/lib/types/types";
import { registrarAuditoria, atorDaSessao } from "@/lib/services/auditoria.service";

// Cliente é um cadastro global (sem filial — ver comentário no schema), então
// as actions usam requireSession (só checa papel) em vez de
// requireSessionComFilial, e a auditoria vai com filialId: null.

export async function criarCliente(dados: ClienteFormValues): Promise<RespostaAcao> {
  try {
    const session = await requireSession(["ADMIN"]);

    const validacao = clienteSchema.safeParse(dados);
    if (!validacao.success) {
      return { sucesso: false, erro: validacao.error.issues[0]?.message ?? "Dados inválidos." };
    }

    await prisma.$transaction(async (tx) => {
      const clienteCriado = await tx.cliente.create({ data: validacao.data });
      await registrarAuditoria(tx, {
        entidade: "Cliente",
        entidadeId: clienteCriado.id,
        acao: "CRIACAO",
        depois: clienteCriado,
        ator: atorDaSessao(session),
        filialId: null,
      });
    });

    revalidatePath("/clientes");
    return { sucesso: true };
  } catch (erro) {
    return { sucesso: false, erro: errorToMessage(erro, "Erro ao criar cliente.") };
  }
}

export async function editarCliente(id: number, dados: ClienteFormValues): Promise<RespostaAcao> {
  try {
    const session = await requireSession(["ADMIN"]);

    const validacao = clienteSchema.safeParse(dados);
    if (!validacao.success) {
      return { sucesso: false, erro: validacao.error.issues[0]?.message ?? "Dados inválidos." };
    }

    const clienteAntes = await prisma.cliente.findUniqueOrThrow({ where: { id } });

    await prisma.$transaction(async (tx) => {
      const clienteDepois = await tx.cliente.update({ where: { id }, data: validacao.data });
      await registrarAuditoria(tx, {
        entidade: "Cliente",
        entidadeId: id,
        acao: "ATUALIZACAO",
        antes: clienteAntes,
        depois: clienteDepois,
        ator: atorDaSessao(session),
        filialId: null,
      });
    });

    revalidatePath("/clientes");
    return { sucesso: true };
  } catch (erro) {
    return { sucesso: false, erro: errorToMessage(erro, "Erro ao editar cliente.") };
  }
}

export async function deletarCliente(id: number): Promise<RespostaAcao> {
  try {
    const session = await requireSession(["ADMIN"]);

    const clienteAntes = await prisma.cliente.findUniqueOrThrow({ where: { id } });

    await prisma.$transaction(async (tx) => {
      const clienteDeletado = await tx.cliente.update({ where: { id }, data: { deletadoEm: new Date() } });
      await registrarAuditoria(tx, {
        entidade: "Cliente",
        entidadeId: id,
        acao: "EXCLUSAO",
        antes: clienteAntes,
        depois: clienteDeletado,
        ator: atorDaSessao(session),
        filialId: null,
      });
    });

    revalidatePath("/clientes");
    return { sucesso: true };
  } catch (erro) {
    return { sucesso: false, erro: errorToMessage(erro, "Erro ao excluir cliente.") };
  }
}
