import { prisma } from "@/lib/prisma"

/** Falhas seguidas pro mesmo e-mail antes de bloquear. */
export const MAX_FALHAS_POR_EMAIL = 5
/** Falhas do mesmo IP (qualquer e-mail) — pega quem testa várias contas. */
export const MAX_FALHAS_POR_IP = 20
/** Janela de contagem e tempo de bloqueio. */
export const JANELA_BLOQUEIO_MINUTOS = 15

/** Linhas mais velhas que isto são apagadas a cada falha nova — a tabela nunca cresce. */
const HORAS_RETENCAO = 24

export class LoginBloqueadoError extends Error {
  constructor() {
    super(`Muitas tentativas de login. Aguarde ${JANELA_BLOQUEIO_MINUTOS} minutos e tente de novo.`)
    this.name = "LoginBloqueadoError"
  }
}

export function normalizarEmail(email: string): string {
  return email.trim().toLowerCase()
}

/** IP de quem está tentando, pelo cabeçalho que a Vercel preenche (primeiro da lista). */
export function ipDaRequisicao(headers: Record<string, string | string[] | undefined> | undefined): string | null {
  const valor = headers?.["x-forwarded-for"] ?? headers?.["x-real-ip"]
  const texto = Array.isArray(valor) ? valor[0] : valor
  return texto?.split(",")[0]?.trim().slice(0, 100) || null
}

function inicioDaJanela(agora: Date): Date {
  return new Date(agora.getTime() - JANELA_BLOQUEIO_MINUTOS * 60 * 1000)
}

/**
 * Lança LoginBloqueadoError se o e-mail ou o IP passaram do limite de falhas
 * na janela — ANTES de conferir a senha, pra quem está tentando adivinhar
 * não ganhar nenhuma informação durante o bloqueio.
 */
export async function garantirLoginNaoBloqueado(email: string, ip: string | null, agora = new Date()) {
  const desde = inicioDaJanela(agora)
  const [falhasEmail, falhasIp] = await Promise.all([
    prisma.tentativaLogin.count({ where: { email, criadoEm: { gte: desde } } }),
    ip ? prisma.tentativaLogin.count({ where: { ip, criadoEm: { gte: desde } } }) : Promise.resolve(0),
  ])

  if (falhasEmail >= MAX_FALHAS_POR_EMAIL || falhasIp >= MAX_FALHAS_POR_IP) {
    throw new LoginBloqueadoError()
  }
}

export async function registrarFalhaLogin(email: string, ip: string | null, agora = new Date()) {
  await prisma.$transaction([
    prisma.tentativaLogin.create({ data: { email, ip, criadoEm: agora } }),
    prisma.tentativaLogin.deleteMany({
      where: { criadoEm: { lt: new Date(agora.getTime() - HORAS_RETENCAO * 60 * 60 * 1000) } },
    }),
  ])
}

/** Login certo zera as falhas daquele e-mail. */
export async function limparFalhasLogin(email: string) {
  await prisma.tentativaLogin.deleteMany({ where: { email } })
}

/** Chave do limite de tentativas do login do motorista (mesma tabela do login por e-mail). */
export function chaveLoginMotorista(seva: number) {
  return `motorista:${seva}`
}

/**
 * O PIN do motorista tem só 6 dígitos: além da janela de 15 min, no máximo
 * 10 erros em 24h por matrícula. Passou disso, só um PIN novo gerado pelo
 * despacho libera (ele zera as tentativas) — quem tenta adivinhar não ganha
 * novas chances esperando.
 */
export const MAX_FALHAS_MOTORISTA_24H = 10

export class PinBloqueadoError extends Error {
  constructor() {
    super("Acesso bloqueado por tentativas erradas. Peça um PIN novo ao despacho.")
    this.name = "PinBloqueadoError"
  }
}

export async function garantirPinNaoBloqueado(chave: string, agora = new Date()) {
  const falhas = await prisma.tentativaLogin.count({
    where: { email: chave, criadoEm: { gte: new Date(agora.getTime() - HORAS_RETENCAO * 60 * 60 * 1000) } },
  })
  if (falhas >= MAX_FALHAS_MOTORISTA_24H) throw new PinBloqueadoError()
}

