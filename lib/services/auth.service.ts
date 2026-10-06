import bcrypt from "bcrypt"
import type { JWT } from "next-auth/jwt"
import { prisma } from "@/lib/prisma"
import { PAPEL_MOTORISTA, ehMotorista } from "@/lib/papeis"
import {
  chaveLoginMotorista,
  reservarTentativaLogin,
  garantirPinNaoBloqueado,
  ipDaRequisicao,
  limparFalhasLogin,
  normalizarEmail,
} from "@/lib/services/login.service"

/** Duração máxima de uma sessão, contada a partir do login (não renova com uso). */
export const DURACAO_SESSAO_SEGUNDOS = 12 * 60 * 60

export const MENSAGEM_CREDENCIAIS_INVALIDAS = "Credenciais inválidas."
export const MENSAGEM_USUARIO_DESATIVADO = "Usuário desativado. Fale com o administrador."
export const MENSAGEM_PIN_INVALIDO = "Matrícula ou PIN inválidos."

/** Hash qualquer pra comparar quando a matrícula não tem acesso — o tempo de resposta não revela se ela existe. */
const HASH_FALSO = "$2b$10$OfJBf9pjWL29US8BcMsxCeqaU3QPKLLQ1WauxSA5EPv4duYd4Gvbu"

class SessaoInvalidaError extends Error {
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

  // Sem "@" não é e-mail — e não pode virar a chave de tentativas do login
  // do motorista ("motorista:123"), senão daria pra bloquear o PIN dele daqui.
  if (!email.includes("@")) {
    throw new Error(MENSAGEM_CREDENCIAIS_INVALIDAS)
  }

  await reservarTentativaLogin(email, ip)

  const usuario = await prisma.usuario.findFirst({
    where: { email: { equals: email, mode: "insensitive" } },
  })

  const senhaValida = usuario?.senha ? await bcrypt.compare(credenciais.senha, usuario.senha) : false

  if (!usuario || !senhaValida) {
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
    versaoSessao: usuario.versaoSessao,
  }
}

type CredenciaisMotorista = { seva?: string; pin?: string } | undefined

/**
 * Login do motorista: matrícula (SEVA) + PIN gerado pelo despacho. Mesmo
 * limite de tentativas do login por e-mail (chave "motorista:<seva>"). A
 * mesma matrícula pode existir em mais de uma filial — vale o acesso cujo
 * PIN bater.
 */
export async function autenticarMotorista(credenciais: CredenciaisMotorista, headers: CabecalhosRequisicao) {
  const sevaTexto = credenciais?.seva?.trim() ?? ""
  const pin = credenciais?.pin?.trim() ?? ""
  if (!/^\d{1,9}$/.test(sevaTexto) || !pin) {
    throw new Error("Preencha a matrícula (SEVA) e o PIN.")
  }

  const seva = Number(sevaTexto)
  const chave = chaveLoginMotorista(seva)
  const ip = ipDaRequisicao(headers)
  await reservarTentativaLogin(chave, ip)
  await garantirPinNaoBloqueado(chave)

  const acessos = await prisma.usuario.findMany({
    where: { role: PAPEL_MOTORISTA, motorista: { seva, deletadoEm: null } },
    select: { id: true, senha: true, ativo: true, versaoSessao: true, motorista: { select: { id: true, nome: true, filialId: true } } },
  })

  let acesso: (typeof acessos)[number] | null = null
  for (const candidato of acessos) {
    if (candidato.senha && (await bcrypt.compare(pin, candidato.senha))) {
      acesso = candidato
      break
    }
  }
  if (acessos.length === 0) await bcrypt.compare(pin, HASH_FALSO)

  if (!acesso?.motorista) {
    throw new Error(MENSAGEM_PIN_INVALIDO)
  }
  if (!acesso.ativo) {
    throw new Error(MENSAGEM_USUARIO_DESATIVADO)
  }

  await limparFalhasLogin(chave)

  return {
    id: acesso.id,
    name: acesso.motorista.nome,
    email: null,
    role: PAPEL_MOTORISTA,
    filialId: acesso.motorista.filialId,
    motoristaId: acesso.motorista.id,
    versaoSessao: acesso.versaoSessao,
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
    select: { ativo: true, role: true, filialId: true, motoristaId: true, versaoSessao: true, motorista: { select: { deletadoEm: true } } },
  })

  if (!usuario) throw new SessaoInvalidaError("Usuário não existe mais.")
  if (!usuario.ativo) throw new SessaoInvalidaError("Usuário desativado.")
  // Token de antes desta versão (sem o campo) conta como 0, o padrão do banco.
  if ((token.versaoSessao ?? 0) !== usuario.versaoSessao) {
    throw new SessaoInvalidaError("Acesso renovado (PIN novo).")
  }
  if (ehMotorista(usuario.role) && (!usuario.motoristaId || !usuario.motorista || usuario.motorista.deletadoEm)) {
    throw new SessaoInvalidaError("Motorista excluído do cadastro.")
  }

  token.role = usuario.role
  token.filialId = usuario.filialId
  token.motoristaId = usuario.motoristaId
  return token
}
