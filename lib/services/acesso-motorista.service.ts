import { randomInt } from "node:crypto"
import bcrypt from "bcrypt"
import { prisma } from "@/lib/prisma"
import { MotoristaNaoEncontradoError } from "@/lib/errors"
import { PAPEL_MOTORISTA } from "@/lib/papeis"
import { registrarAuditoria, type Ator } from "@/lib/services/auditoria.service"
import { CAMPO_CONTEXTO_AUDITORIA } from "@/lib/utils/diff-auditoria"
import { chaveLoginMotorista, limparFalhasLogin } from "@/lib/services/login.service"

/**
 * Acesso do motorista à área "Minhas viagens": um usuário com papel
 * MOTORISTA ligado ao cadastro dele. Entra com a matrícula (SEVA) e um PIN
 * de 6 dígitos que o despacho gera (e pode gerar de novo se ele esquecer).
 * O PIN só aparece uma vez, na hora de gerar — no banco fica só o hash.
 */

export type SituacaoAcesso = "SEM_ACESSO" | "ATIVO" | "DESATIVADO"

/** Snapshot pro histórico — nunca com o hash do PIN. */
function paraAuditoria(usuario: { nome: string | null; role: string; ativo: boolean; motoristaId: number | null } | null) {
  return usuario ? { nome: usuario.nome, papel: usuario.role, ativo: usuario.ativo, motoristaId: usuario.motoristaId } : null
}

async function motoristaDaFilial(filialId: number, motoristaId: number) {
  const motorista = await prisma.motorista.findFirst({
    where: { id: motoristaId, filialId, deletadoEm: null },
    select: { id: true, nome: true, seva: true },
  })
  if (!motorista) throw new MotoristaNaoEncontradoError()
  return motorista
}

export async function situacaoAcessoMotorista(motoristaId: number): Promise<SituacaoAcesso> {
  const acesso = await prisma.usuario.findUnique({ where: { motoristaId }, select: { ativo: true } })
  return !acesso ? "SEM_ACESSO" : acesso.ativo ? "ATIVO" : "DESATIVADO"
}

/** Cria o acesso (ou reativa) com um PIN novo. Devolve o PIN pra mostrar uma vez. */
export async function gerarPinMotorista(filialId: number, motoristaId: number, ator: Ator) {
  const motorista = await motoristaDaFilial(filialId, motoristaId)
  const pin = String(randomInt(0, 1_000_000)).padStart(6, "0")
  const senha = await bcrypt.hash(pin, 10)

  await prisma.$transaction(async (tx) => {
    const antes = await tx.usuario.findUnique({ where: { motoristaId } })
    const depois = await tx.usuario.upsert({
      where: { motoristaId },
      create: { nome: motorista.nome, role: PAPEL_MOTORISTA, filialId, motoristaId, senha, ativo: true },
      update: { nome: motorista.nome, role: PAPEL_MOTORISTA, filialId, senha, ativo: true, versaoSessao: { increment: 1 } },
    })
    await registrarAuditoria(tx, {
      entidade: "Usuario",
      entidadeId: depois.id,
      acao: antes ? "ATUALIZACAO" : "CRIACAO",
      antes: paraAuditoria(antes) ?? undefined,
      depois: {
        ...paraAuditoria(depois),
        PIN: antes ? "gerado de novo" : "criado",
        [CAMPO_CONTEXTO_AUDITORIA]: `Acesso do motorista ${motorista.nome} (SEVA ${motorista.seva})`,
      },
      ator,
      filialId,
    })
  })

  // PIN novo libera quem estava bloqueado por tentativas erradas.
  await limparFalhasLogin(chaveLoginMotorista(motorista.seva))

  return { pin, seva: motorista.seva }
}

/** Desativa o acesso — a sessão aberta dele cai no próximo clique (ver revalidarToken). */
export async function desativarAcessoMotorista(filialId: number, motoristaId: number, ator: Ator) {
  const motorista = await motoristaDaFilial(filialId, motoristaId)
  await prisma.$transaction(async (tx) => {
    const antes = await tx.usuario.findUnique({ where: { motoristaId } })
    if (!antes || !antes.ativo) return
    const depois = await tx.usuario.update({ where: { motoristaId }, data: { ativo: false } })
    await registrarAuditoria(tx, {
      entidade: "Usuario",
      entidadeId: depois.id,
      acao: "ATUALIZACAO",
      antes: paraAuditoria(antes) ?? undefined,
      depois: { ...paraAuditoria(depois), [CAMPO_CONTEXTO_AUDITORIA]: `Acesso do motorista ${motorista.nome} (SEVA ${motorista.seva})` },
      ator,
      filialId,
    })
  })
}
