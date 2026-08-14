'use server'
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth-guard";
import { errorToMessage } from "@/lib/action-error";
import { filialSchema, type FilialFormValues } from "@/lib/validation/filiais";
import type { RespostaAcao } from "@/lib/types/types";

export async function criarFilial(dados: FilialFormValues): Promise<RespostaAcao> {
  try {
    await requireSession(["SUPERADMIN"]);

    const validacao = filialSchema.safeParse(dados);
    if (!validacao.success) {
      return { sucesso: false, erro: validacao.error.issues[0]?.message ?? "Dados inválidos." };
    }

    await prisma.filial.create({ data: validacao.data });

    revalidatePath("/admin/filiais");
    return { sucesso: true };
  } catch (erro) {
    return { sucesso: false, erro: errorToMessage(erro, "Erro ao criar filial.") };
  }
}
