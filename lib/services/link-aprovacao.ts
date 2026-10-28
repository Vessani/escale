import { createHash, randomBytes } from "node:crypto"
import { prisma } from "@/lib/prisma"
import { ErroDeDominio } from "@/lib/errors"
import { VALIDADE_LINK_HORAS } from "@/lib/services/link-aprovacao-regras"

/**
 * O link de aprovação, comum a todo pedido que vai pro grupo da filial
 * (estouro de jornada, Uber).
 *
 * Segurança: o token tem 256 bits (impossível de adivinhar), só o hash dele
 * vai pro banco, vale VALIDADE_LINK_HORAS e serve pra UMA decisão. Abrir a
 * página (GET) nunca decide nada — o WhatsApp abre o link sozinho pra montar
 * a prévia, então a decisão só acontece no clique (POST da action). Limite
 * conhecido: o link circula no grupo, então qualquer membro consegue decidir
 * — o nome é declarado por quem clicou; o IP fica junto como rastro.
 */

export type LinkGerado = { id: number; url: string; linkWhatsApp: string }

/** Token novo + o hash que vai pro banco. O token em claro só existe na resposta. */
export function gerarTokenLink(): { token: string; tokenHash: string } {
  const token = randomBytes(32).toString("base64url")
  return { token, tokenHash: hashDoToken(token) }
}

export function hashDoToken(token: string): string {
  return createHash("sha256").update(token).digest("hex")
}

export function expiracaoDoLink(agora: Date): Date {
  return new Date(agora.getTime() + VALIDADE_LINK_HORAS * 60 * 60 * 1000)
}

/**
 * Endereço público do sistema, base dos links de aprovação.
 * Usa NEXTAUTH_URL (ver .env.example). Na Vercel, se ela não estiver
 * configurada, cai no domínio de produção que a própria Vercel expõe
 * (VERCEL_PROJECT_PRODUCTION_URL, sem "https://") — o link vai pro grupo,
 * então tem de ser o de produção, nunca o de um preview.
 */
export function enderecoDoSistema(env: Record<string, string | undefined> = process.env): string | undefined {
  if (env.NEXTAUTH_URL) return env.NEXTAUTH_URL
  if (env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${env.VERCEL_PROJECT_PRODUCTION_URL}`
  return undefined
}

/**
 * Endereço da página pública de aprovação (`caminho`, ex: /aprovar-uber).
 * Em teste local, "localhost" não abre no celular — pra testar no celular,
 * use o IP da máquina na rede (ex: http://192.168.0.10:3000) em NEXTAUTH_URL.
 */
export function urlDeAprovacao(caminho: string, token: string, base = enderecoDoSistema()): string {
  if (!base) throw new ErroDeDominio("URL_SISTEMA_AUSENTE", "Endereço do sistema não configurado (NEXTAUTH_URL).")
  return `${base.replace(/\/+$/, "")}${caminho}/${token}`
}

/**
 * Confere quem vai no pedido: o motorista tem de ser da filial, e a viagem
 * (opcional) tem de ser dele, como principal ou acompanhante. Devolve o nome
 * e o número da viagem pra mensagem do grupo.
 */
export async function conferirMotoristaEViagem(filialId: number, motoristaId: number, viagemId: number | null) {
  const motorista = await prisma.motorista.findFirst({
    where: { id: motoristaId, filialId, deletadoEm: null },
    select: { id: true, nome: true },
  })
  if (!motorista) throw new ErroDeDominio("MOTORISTA_NAO_ENCONTRADO", "Motorista não encontrado nesta filial.")

  let numViagem: string | null = null
  if (viagemId !== null) {
    const viagem = await prisma.viagem.findFirst({
      where: {
        id: viagemId,
        filialId,
        deletadoEm: null,
        OR: [{ motoristaId: motorista.id }, { motoristaAcompanhanteId: motorista.id }],
      },
      select: { numViagem: true },
    })
    if (!viagem) throw new ErroDeDominio("VIAGEM_NAO_E_DO_MOTORISTA", "Essa viagem não é desse motorista.")
    numViagem = viagem.numViagem
  }
  return { motorista, numViagem }
}

/** A auditoria guarda o antes/depois — sem o hash do token, que não serve pra nada no log. */
export function semToken<T extends { tokenHash?: string }>(registro: T): Omit<T, "tokenHash"> {
  const copia: Partial<T> = { ...registro }
  delete copia.tokenHash
  return copia as Omit<T, "tokenHash">
}
