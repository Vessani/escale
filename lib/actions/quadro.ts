'use server'
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSessionComFilial } from "@/lib/auth-guard";
import { errorToMessage } from "@/lib/action-error";
import type { RespostaAcao } from "@/lib/types/types";
import { z } from "@/lib/validation/zod";
import { registrarAuditoria, atorDaSessao } from "@/lib/services/auditoria.service";

/** Recado do quadro do Dashboard — texto livre, mas não um documento. */
const TAMANHO_MAXIMO_QUADRO = 5000;

/** Sobrescreve o texto do quadro de observações (um bloco por filial) — o histórico de versões anteriores fica em RegistroAuditoria. */
export async function atualizarObservacoes(texto: string): Promise<RespostaAcao> {
  try {
    const { session, filialId } = await requireSessionComFilial();
    texto = z.string().max(TAMANHO_MAXIMO_QUADRO, `O quadro aceita até ${TAMANHO_MAXIMO_QUADRO} caracteres.`).parse(texto);

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
    const mensagem = errorToMessage(erro, "Não foi possível salvar as observações.");
    return { sucesso: false, erro: mensagem };
  }
}
