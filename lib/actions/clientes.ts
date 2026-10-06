'use server'
import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth-guard";
import { errorToMessage } from "@/lib/action-error";
import { clienteSchema, type ClienteFormValues } from "@/lib/validation/clientes";
import type { RespostaAcao } from "@/lib/types/types";
import { atorDaSessao } from "@/lib/services/auditoria.service";
import { criarClienteService, deletarClienteService, editarClienteService } from "@/lib/services/cliente.service";
import { z } from "@/lib/validation/zod";

// Cliente é um cadastro global (sem filial — ver comentário no schema), então
// as actions usam requireSession (só checa papel) em vez de
// requireSessionComFilial.

const idSchema = z.number().int().positive();

export async function criarCliente(dados: ClienteFormValues): Promise<RespostaAcao> {
  try {
    const session = await requireSession(["ADMIN"]);
    await criarClienteService(clienteSchema.parse(dados), atorDaSessao(session));
    revalidatePath("/clientes");
    return { sucesso: true };
  } catch (erro) {
    return { sucesso: false, erro: errorToMessage(erro, "Erro ao criar cliente.") };
  }
}

export async function editarCliente(id: number, dados: ClienteFormValues): Promise<RespostaAcao> {
  try {
    const session = await requireSession(["ADMIN"]);
    await editarClienteService(idSchema.parse(id), clienteSchema.parse(dados), atorDaSessao(session));
    revalidatePath("/clientes");
    return { sucesso: true };
  } catch (erro) {
    return { sucesso: false, erro: errorToMessage(erro, "Erro ao editar cliente.") };
  }
}

export async function deletarCliente(id: number): Promise<RespostaAcao> {
  try {
    const session = await requireSession(["ADMIN"]);
    await deletarClienteService(idSchema.parse(id), atorDaSessao(session));
    revalidatePath("/clientes");
    return { sucesso: true };
  } catch (erro) {
    return { sucesso: false, erro: errorToMessage(erro, "Erro ao excluir cliente.") };
  }
}
