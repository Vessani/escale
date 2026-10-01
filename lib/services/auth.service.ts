import bcrypt from "bcrypt"
import type { JWT } from "next-auth/jwt"
import { prisma } from "@/lib/prisma"
import {
  garantirLoginNaoBloqueado,
  ipDaRequisicao,
  limparFalhasLogin,
  normalizarEmail,
  registrarFalhaLogin,
} from "@/lib/services/login.service"

/** Duração máxima de uma sessão, contada a partir do login (não renova com uso). */
export const DURACAO_SESSAO_SEGUNDOS = 12 * 60 * 60

export const MENSAGEM_CREDENCIAIS_INVALIDAS = "Credenciais inválidas."
export const MENSAGEM_USUARIO_DESATIVADO = "Usuário desativado. Fale com o administrador."

export class SessaoInvalidaError extends Error {
  constructor(motivo: string) {
    super(motivo)
    this.name = "SessaoInvalidaError"
  }
}

type Credenciais = { email?: string; senha?: string } | undefined
type CabecalhosRequisicao = Record<string, string | string[] | undefined> | undefined

/**
 * Confere e-mail/senha com limite de tentativas. As mensagens de erro chegam
 * à tela de login, por isso "e-mail não existe" e "senha errada" são iguais.
 */
export async function autenticarUsuario(credenciais: Credenciais, headers: CabecalhosRequisicao) {
  if (!credenciais?.email || !credenciais?.senha) {
    throw new Error("Por favor, preencha o e-mail e a senha.")
  }

  const email = normalizarEmail(credenciais.email)
  const ip = ipDaRequisicao(headers)

  await garantirLoginNaoBloqueado(email, ip)

  const usuario = await prisma.usuario.findFirst({
    where: { email: { equals: email, mode: "insensitive" } },
  })

  const senhaValida = usuario?.senha ? await bcrypt.compare(credenciais.senha, usuario.senha) : false

  if (!usuario || !senhaValida) {
    await registrarFalhaLogin(email, ip)
    throw new Error(MENSAGEM_CREDENCIAIS_INVALIDAS)
  }

  // Só revela que a conta está desativada para quem acertou a senha.
  if (!usuario.ativo) {
    throw new Error(MENSAGEM_USUARIO_DESATIVADO)
  }

  await limparFalhasLogin(email)

  return {
    id: usuario.id,
    name: usuario.nome,
    email: usuario.email,
    role: usuario.role,
    filialId: usuario.filialId,
  }
}

/**
 * Roda a cada leitura de sessão (getServerSession). Lançar aqui faz o
 * next-auth descartar o cookie e a sessão vira null — é assim que desativar
 * um usuário ou trocar o papel dele vale na hora, sem esperar o token expirar.
 */
export async function revalidarToken(token: JWT, agora = Date.now()): Promise<JWT> {
  if (!token.id) throw new SessaoInvalidaError("Token sem usuário.")

  const loginEm = typeof token.loginEm === "number" ? token.loginEm : 0
  if (agora - loginEm > DURACAO_SESSAO_SEGUNDOS * 1000) {
    throw new SessaoInvalidaError("Sessão expirada.")
  }

  const usuario = await prisma.usuario.findUnique({
    where: { id: token.id },
    select: { ativo: true, role: true, filialId: true },
  })

  if (!usuario) throw new SessaoInvalidaError("Usuário não existe mais.")
  if (!usuario.ativo) throw new SessaoInvalidaError("Usuário desativado.")

  token.role = usuario.role
  token.filialId = usuario.filialId
  return token
}
