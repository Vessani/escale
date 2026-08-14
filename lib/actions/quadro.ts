'use server'
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSessionComFilial } from "@/lib/auth-guard";
import { errorToMessage } from "@/lib/action-error";
import type { RespostaAcao } from "@/lib/types/types";

/** Sobrescreve o texto do quadro de observações (um bloco por filial, sem histórico). */
export async function atualizarObservacoes(texto: string): Promise<RespostaAcao> {
  try {
    const { filialId } = await requireSessionComFilial();

    await prisma.quadroObservacao.upsert({
      where: { filialId },
      create: { filialId, texto },
      update: { texto },
    });

    revalidatePath("/");
    return { sucesso: true };
  } catch (erro) {
    console.error("[atualizarObservacoes] Erro ao salvar observações:", erro);
    const mensagem = errorToMessage(erro, "Não foi possível salvar as observações.");
    return { sucesso: false, erro: mensagem };
  }
}
