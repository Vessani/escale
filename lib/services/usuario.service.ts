import bcrypt from "bcrypt"
import { prisma } from "@/lib/prisma"
import { ErroDeDominio } from "@/lib/errors"
import type { UsuarioFormValues } from "@/lib/validation/usuarios"
import { registrarAuditoria, type Ator } from "./auditoria.service"

/**
 * Usuários do sistema (Superadmin, Admin, Despachante). Usuário nunca é
 * apagado — a auditoria guarda quem fez cada coisa — e senha/hash nunca vão
 * pra auditoria.
 */

const CUSTO_HASH_SENHA = 10

export async function criarUsuarioService(dados: UsuarioFormValues, ator: Ator | null) {
  const senhaHash = await bcrypt.hash(dados.senha, CUSTO_HASH_SENHA)
  const filialId = dados.role === "SUPERADMIN" ? null : dados.filialId

  return prisma.$transaction(async (tx) => {
    // O login ignora maiúsculas no e-mail — então o cadastro também precisa.
    const emailEmUso = await tx.usuario.findFirst({
      where: { email: { equals: dados.email, mode: "insensitive" } },
      select: { id: true },
    })
    if (emailEmUso) throw new ErroDeDominio("EMAIL_EM_USO", "Já existe um usuário com esse e-mail.")

    const criado = await tx.usuario.create({
      data: { nome: dados.nome, email: dados.email, senha: senhaHash, role: dados.role, filialId },
    })
    await registrarAuditoria(tx, {
      entidade: "Usuario",
      entidadeId: criado.id,
      acao: "CRIACAO",
      depois: { nome: criado.nome, email: criado.email, role: criado.role, filialId: criado.filialId },
      ator,
      filialId,
    })
    return criado
  })
}

/**
 * Ativa/desativa. Desativar derruba a sessão dele no próximo acesso
 * (callbacks.jwt em lib/auth.ts confere `ativo` no banco). Nunca deixa o
 * sistema sem Superadmin ativo, nem a pessoa desativar a si mesma.
 */
export async function alterarUsuarioAtivoService(usuarioId: string, ativo: boolean, ator: Ator) {
  if (usuarioId === ator.usuarioId && !ativo) {
    throw new ErroDeDominio("DESATIVAR_SI_MESMO", "Você não pode desativar o seu próprio usuário.")
  }

  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Usuario" WHERE id = ${usuarioId} FOR UPDATE`
    const usuario = await tx.usuario.findUnique({
      where: { id: usuarioId },
      select: { id: true, ativo: true, role: true, filialId: true },
    })
    if (!usuario) throw new ErroDeDominio("USUARIO_NAO_ENCONTRADO", "Usuário não encontrado.")
    if (usuario.ativo === ativo) return

    if (!ativo && usuario.role === "SUPERADMIN") {
      const outrosSuperadmins = await tx.usuario.count({ where: { role: "SUPERADMIN", ativo: true, id: { not: usuarioId } } })
      if (outrosSuperadmins === 0) {
        throw new ErroDeDominio("ULTIMO_SUPERADMIN", "Não dá pra desativar o último Superadmin ativo.")
      }
    }

    await tx.usuario.update({ where: { id: usuarioId }, data: { ativo } })
    await registrarAuditoria(tx, {
      entidade: "Usuario",
      entidadeId: usuarioId,
      acao: "ATUALIZACAO",
      antes: { ativo: usuario.ativo },
      depois: { ativo },
      ator,
      filialId: usuario.filialId,
    })
  })
}

/** Troca da própria senha, mediante a senha atual. */
export async function trocarSenhaPropriaService(ator: Ator, filialId: number | null, dados: { senhaAtual: string; novaSenha: string }) {
  const usuario = await prisma.usuario.findUnique({ where: { id: ator.usuarioId }, select: { senha: true } })
  if (!usuario?.senha) throw new ErroDeDominio("USUARIO_INVALIDO", "Usuário inválido.")

  const senhaAtualConfere = await bcrypt.compare(dados.senhaAtual, usuario.senha)
  if (!senhaAtualConfere) throw new ErroDeDominio("SENHA_ATUAL_INCORRETA", "Senha atual incorreta.")

  const senhaHash = await bcrypt.hash(dados.novaSenha, CUSTO_HASH_SENHA)
  await prisma.$transaction(async (tx) => {
    await tx.usuario.update({ where: { id: ator.usuarioId }, data: { senha: senhaHash } })
    // antes/depois de propósito vazios — só o fato de ter trocado importa.
    await registrarAuditoria(tx, { entidade: "Usuario", entidadeId: ator.usuarioId, acao: "ATUALIZACAO", ator, filialId })
  })
}
