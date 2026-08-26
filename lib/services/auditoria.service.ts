import type { Prisma, AcaoAuditoria } from "@prisma/client";
import { serializeData } from "@/lib/serialization";

export type Ator = { usuarioId: string; usuarioNome: string | null };

/** Converte session.user (ver lib/auth-guard.ts) num Ator. */
export function atorDaSessao(session: { user: { id: string; name?: string | null } }): Ator {
  return { usuarioId: session.user.id, usuarioNome: session.user.name ?? null };
}

type ParametrosAuditoria = {
  entidade: string;
  entidadeId: number | string;
  acao: AcaoAuditoria;
  antes?: unknown;
  depois?: unknown;
  ator: Ator | null;
  filialId: number | null;
};

/**
 * Grava uma linha de auditoria — sempre chamada de dentro da mesma
 * transação da escrita real, nunca depois dela isolada (senão log e mudança
 * podem existir um sem o outro em caso de falha parcial). antes/depois
 * passam por serializeData automaticamente — os call sites passam os
 * objetos Prisma crus (com Date/Decimal), sem serializar antes.
 *
 * Nunca passar senha/hash de Usuario em antes/depois — não há redação
 * automática aqui, o call site é responsável por não incluir esses campos.
 */
export async function registrarAuditoria(
  tx: Prisma.TransactionClient,
  { entidade, entidadeId, acao, antes, depois, ator, filialId }: ParametrosAuditoria,
) {
  await tx.registroAuditoria.create({
    data: {
      entidade,
      entidadeId: String(entidadeId),
      acao,
      antes: antes === undefined ? undefined : (serializeData(antes) as Prisma.InputJsonValue),
      depois: depois === undefined ? undefined : (serializeData(depois) as Prisma.InputJsonValue),
      usuarioId: ator?.usuarioId ?? null,
      usuarioNome: ator?.usuarioNome ?? null,
      filialId,
    },
  });
}
