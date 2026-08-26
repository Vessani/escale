'use server'
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSessionComFilial } from "@/lib/auth-guard";
import { errorToMessage } from "@/lib/action-error";
import type { RespostaAcao } from "@/lib/types/types";
import { registrarAuditoria, atorDaSessao } from "@/lib/services/auditoria.service";

/** Sobrescreve o texto do quadro de observações (um bloco por filial) — o histórico de versões anteriores fica em RegistroAuditoria. */
export async function atualizarObservacoes(texto: string): Promise<RespostaAcao> {
  try {
    const { session, filialId } = await requireSessionComFilial();

    const quadroAntes = await prisma.quadroObservacao.findUnique({ where: { filialId } });

    await prisma.$transaction(async (tx) => {
      const quadroDepois = await tx.quadroObservacao.upsert({
        where: { filialId },
        create: { filialId, texto },
        update: { texto },
      });

      await registrarAuditoria(tx, {
        entidade: "QuadroObservacao",
        // Sem id próprio relevante pro usuário — usa filialId como chave estável.
        entidadeId: String(filialId),
        acao: quadroAntes ? "ATUALIZACAO" : "CRIACAO",
        antes: quadroAntes,
        depois: quadroDepois,
        ator: atorDaSessao(session),
        filialId,
      });
    });

    revalidatePath("/");
    return { sucesso: true };
  } catch (erro) {
    console.error("[atualizarObservacoes] Erro ao salvar observações:", erro);
    const mensagem = errorToMessage(erro, "Não foi possível salvar as observações.");
    return { sucesso: false, erro: mensagem };
  }
}
