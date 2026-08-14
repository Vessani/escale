'use server'
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth-guard";
import { errorToMessage } from "@/lib/action-error";
import { clienteSchema, type ClienteFormValues } from "@/lib/validation/clientes";
import type { RespostaAcao } from "@/lib/types/types";

// Cliente é um cadastro global (sem filial — ver comentário no schema), então
// as actions usam requireSession (só checa papel) em vez de
// requireSessionComFilial.

export async function criarCliente(dados: ClienteFormValues): Promise<RespostaAcao> {
  try {
    await requireSession(["ADMIN"]);

    const validacao = clienteSchema.safeParse(dados);
    if (!validacao.success) {
      return { sucesso: false, erro: validacao.error.issues[0]?.message ?? "Dados inválidos." };
    }

    await prisma.cliente.create({ data: validacao.data });

    revalidatePath("/clientes");
    return { sucesso: true };
  } catch (erro) {
    return { sucesso: false, erro: errorToMessage(erro, "Erro ao criar cliente.") };
  }
}

export async function editarCliente(id: number, dados: ClienteFormValues): Promise<RespostaAcao> {
  try {
    await requireSession(["ADMIN"]);

    const validacao = clienteSchema.safeParse(dados);
    if (!validacao.success) {
      return { sucesso: false, erro: validacao.error.issues[0]?.message ?? "Dados inválidos." };
    }

    await prisma.cliente.update({ where: { id }, data: validacao.data });

    revalidatePath("/clientes");
    return { sucesso: true };
  } catch (erro) {
    return { sucesso: false, erro: errorToMessage(erro, "Erro ao editar cliente.") };
  }
}

export async function deletarCliente(id: number): Promise<RespostaAcao> {
  try {
    await requireSession(["ADMIN"]);

    await prisma.cliente.update({ where: { id }, data: { deletadoEm: new Date() } });

    revalidatePath("/clientes");
    return { sucesso: true };
  } catch (erro) {
    return { sucesso: false, erro: errorToMessage(erro, "Erro ao excluir cliente.") };
  }
}
