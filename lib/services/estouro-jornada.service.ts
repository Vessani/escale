import { createHash, randomBytes } from "node:crypto"
import type { MotivoEstouro } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { ErroDeDominio } from "@/lib/errors"
import { registrarAuditoria, type Ator } from "@/lib/services/auditoria.service"
import { STATUS_A_INICIAR, STATUS_EM_ANDAMENTO } from "@/lib/services/viagem-status.service"
import {
  CAMINHO_APROVACAO,
  VALIDADE_LINK_HORAS,
  montarLinkWhatsApp,
  montarMensagemWhatsApp,
  situacaoDoEstouro,
} from "@/lib/services/estouro-jornada-regras"

/**
 * Estouro de jornada aprovado por link.
 *
 * Fluxo: o motorista (na área dele) ou o escalador cria a solicitação → o
 * sistema gera um token aleatório e devolve o link do WhatsApp com a
 * mensagem pronta → a pessoa posta no grupo da filial → o gestor abre o
 * link (página pública, sem login), digita o nome e aprova ou recusa →
 * fica gravado quem pediu, quem decidiu, quando, de qual IP e a observação.
 *
 * Segurança do link: o token tem 256 bits (impossível de adivinhar), só o
 * hash dele vai pro banco, vale VALIDADE_LINK_HORAS e serve pra UMA decisão.
 * Abrir a página (GET) nunca decide nada — o WhatsApp abre o link sozinho pra
 * montar a prévia, então a decisão só acontece no clique (POST da action).
 * Limite conhecido: o link circula no grupo, então qualquer membro consegue
 * decidir — o nome é declarado por quem clicou; o IP fica junto como rastro.
 */

const ENTIDADE = "EstouroJornada"

/** Token novo + o hash que vai pro banco. O token em claro só existe na resposta. */
export function gerarTokenEstouro(): { token: string; tokenHash: string } {
  const token = randomBytes(32).toString("base64url")
  return { token, tokenHash: hashDoToken(token) }
}

export function hashDoToken(token: string): string {
  return createHash("sha256").update(token).digest("hex")
}

function expiracao(agora: Date): Date {
  return new Date(agora.getTime() + VALIDADE_LINK_HORAS * 60 * 60 * 1000)
}

/**
 * Endereço do sistema pra montar o link. NEXTAUTH_URL já é obrigatória (ver
 * .env.example). Em teste local, "localhost" não abre no celular — pra
 * testar no celular, use o IP da máquina na rede (ex:
 * http://192.168.0.10:3000) em NEXTAUTH_URL.
 */
export function urlDeAprovacao(token: string, base = process.env.NEXTAUTH_URL): string {
  if (!base) throw new ErroDeDominio("URL_SISTEMA_AUSENTE", "Endereço do sistema não configurado (NEXTAUTH_URL).")
  return `${base.replace(/\/+$/, "")}${CAMINHO_APROVACAO}/${token}`
}

type DadosSolicitacao = {
  motoristaId: number
  viagemId: number | null
  minutosExtras: number
  motivos: MotivoEstouro[]
}

export type LinkGerado = { id: number; url: string; linkWhatsApp: string }

export async function criarSolicitacaoEstouro(
  filialId: number,
  dados: DadosSolicitacao,
  ator: Ator,
  { pedidoPeloMotorista = false, agora = new Date() }: { pedidoPeloMotorista?: boolean; agora?: Date } = {},
): Promise<LinkGerado> {
  const motorista = await prisma.motorista.findFirst({
    where: { id: dados.motoristaId, filialId, deletadoEm: null },
    select: { id: true, nome: true },
  })
  if (!motorista) throw new ErroDeDominio("MOTORISTA_NAO_ENCONTRADO", "Motorista não encontrado nesta filial.")

  let numViagem: string | null = null
  if (dados.viagemId !== null) {
    const viagem = await prisma.viagem.findFirst({
      where: {
        id: dados.viagemId,
        filialId,
        deletadoEm: null,
        OR: [{ motoristaId: motorista.id }, { motoristaAcompanhanteId: motorista.id }],
      },
      select: { numViagem: true },
    })
    if (!viagem) throw new ErroDeDominio("VIAGEM_NAO_E_DO_MOTORISTA", "Essa viagem não é desse motorista.")
    numViagem = viagem.numViagem
  }

  // Um pedido em aberto por motorista: evita dois links no grupo pro mesmo
  // estouro e o gestor aprovar o errado. Link vencido não conta — dá pra
  // pedir de novo.
  const emAberto = await prisma.estouroJornada.findFirst({
    where: { filialId, motoristaId: motorista.id, status: "PENDENTE", expiraEm: { gt: agora } },
    select: { id: true },
  })
  if (emAberto) {
    throw new ErroDeDominio(
      "ESTOURO_JA_PENDENTE",
      "Já existe um pedido aguardando o gestor pra esse motorista. Cancele ou espere a resposta antes de pedir outro.",
    )
  }

  const { token, tokenHash } = gerarTokenEstouro()
  const url = urlDeAprovacao(token)

  const estouro = await prisma.$transaction(async (tx) => {
    const criado = await tx.estouroJornada.create({
      data: {
        filialId,
        motoristaId: motorista.id,
        viagemId: dados.viagemId,
        minutosExtras: dados.minutosExtras,
        motivos: dados.motivos,
        tokenHash,
        expiraEm: expiracao(agora),
        solicitadoPorId: ator.usuarioId,
        solicitadoPorNome: ator.usuarioNome,
        pedidoPeloMotorista,
      },
    })
    await registrarAuditoria(tx, { entidade: ENTIDADE, entidadeId: criado.id, acao: "CRIACAO", depois: semToken(criado), ator, filialId })
    return criado
  })

  const mensagem = montarMensagemWhatsApp({
    motorista: motorista.nome,
    numViagem,
    minutosExtras: estouro.minutosExtras,
    motivos: estouro.motivos,
    solicitante: ator.usuarioNome,
    url,
  })
  return { id: estouro.id, url, linkWhatsApp: montarLinkWhatsApp(mensagem) }
}

/** `doMotorista`: na área do motorista, ele só mexe nos pedidos dele. */
function filtroPedido(filialId: number, id: number, doMotorista?: number) {
  return { id, filialId, ...(doMotorista !== undefined && { motoristaId: doMotorista }) }
}

/**
 * Link novo pra um pedido ainda pendente (o anterior venceu, ou a pessoa
 * fechou a tela sem enviar). O token antigo deixa de valer na hora.
 */
export async function gerarNovoLinkEstouro(
  filialId: number,
  id: number,
  ator: Ator,
  { doMotorista, agora = new Date() }: { doMotorista?: number; agora?: Date } = {},
): Promise<LinkGerado> {
  const filtro = filtroPedido(filialId, id, doMotorista)
  const antes = await prisma.estouroJornada.findFirst({
    where: filtro,
    include: { motorista: { select: { nome: true } }, viagem: { select: { numViagem: true } } },
  })
  if (!antes) throw new ErroDeDominio("ESTOURO_NAO_ENCONTRADO", "Pedido de estouro não encontrado.")
  if (antes.status !== "PENDENTE")
    throw new ErroDeDominio("ESTOURO_JA_DECIDIDO", "Esse pedido já foi encerrado — não dá pra gerar outro link.")

  const { token, tokenHash } = gerarTokenEstouro()
  const url = urlDeAprovacao(token)

  await prisma.$transaction(async (tx) => {
    const { count } = await tx.estouroJornada.updateMany({
      where: { ...filtro, status: "PENDENTE" },
      data: { tokenHash, expiraEm: expiracao(agora) },
    })
    if (count === 0) throw new ErroDeDominio("ESTOURO_MUDOU", "O pedido foi respondido nesse meio-tempo. Atualize a tela.")
    const depois = await tx.estouroJornada.findUniqueOrThrow({ where: { id } })
    await registrarAuditoria(tx, {
      entidade: ENTIDADE,
      entidadeId: id,
      acao: "ATUALIZACAO",
      antes: semToken(antes),
      depois: semToken(depois),
      ator,
      filialId,
    })
  })

  const mensagem = montarMensagemWhatsApp({
    motorista: antes.motorista.nome,
    numViagem: antes.viagem?.numViagem ?? null,
    minutosExtras: antes.minutosExtras,
    motivos: antes.motivos,
    solicitante: ator.usuarioNome,
    url,
  })
  return { id, url, linkWhatsApp: montarLinkWhatsApp(mensagem) }
}

export async function cancelarSolicitacaoEstouro(filialId: number, id: number, ator: Ator, { doMotorista }: { doMotorista?: number } = {}) {
  const filtro = filtroPedido(filialId, id, doMotorista)
  await prisma.$transaction(async (tx) => {
    const antes = await tx.estouroJornada.findFirst({ where: filtro })
    if (!antes) throw new ErroDeDominio("ESTOURO_NAO_ENCONTRADO", "Pedido de estouro não encontrado.")
    const { count } = await tx.estouroJornada.updateMany({ where: { ...filtro, status: "PENDENTE" }, data: { status: "CANCELADO" } })
    if (count === 0) throw new ErroDeDominio("ESTOURO_JA_DECIDIDO", "Esse pedido já foi respondido pelo gestor ou cancelado.")
    const depois = await tx.estouroJornada.findUniqueOrThrow({ where: { id } })
    await registrarAuditoria(tx, {
      entidade: ENTIDADE,
      entidadeId: id,
      acao: "ATUALIZACAO",
      antes: semToken(antes),
      depois: semToken(depois),
      ator,
      filialId,
    })
  })
}

/** O que a página pública mostra — nunca ids, IP nem dados de outra solicitação. */
export async function buscarEstouroPorToken(token: string, agora = new Date()) {
  const estouro = await prisma.estouroJornada.findUnique({
    where: { tokenHash: hashDoToken(token) },
    select: {
      status: true,
      expiraEm: true,
      minutosExtras: true,
      motivos: true,
      solicitadoPorNome: true,
      criadoEm: true,
      decididoEm: true,
      decididoPorNome: true,
      observacaoGestor: true,
      motorista: { select: { nome: true } },
      viagem: { select: { numViagem: true, inicioPrevisto: true, fimPrevisto: true } },
      filial: { select: { nome: true } },
    },
  })
  if (!estouro) return null
  return { ...estouro, situacao: situacaoDoEstouro(estouro, agora) }
}

/**
 * A decisão pelo link. Só vale uma vez e só dentro da validade: o
 * updateMany com status PENDENTE + expiraEm no futuro garante isso mesmo com
 * dois cliques simultâneos (só um muda a linha).
 */
export async function decidirEstouroPorToken(
  token: string,
  decisao: "APROVADO" | "RECUSADO",
  { nome, observacao, ip }: { nome: string; observacao?: string; ip: string | null },
  agora = new Date(),
) {
  const tokenHash = hashDoToken(token)
  const antes = await prisma.estouroJornada.findUnique({ where: { tokenHash } })
  if (!antes) throw new ErroDeDominio("LINK_INVALIDO", "Link inválido ou substituído por um mais novo. Peça um novo link a quem pediu.")

  const situacao = situacaoDoEstouro(antes, agora)
  if (situacao === "EXPIRADO") throw new ErroDeDominio("LINK_EXPIRADO", "Esse link expirou. Peça um novo a quem pediu.")
  if (situacao !== "PENDENTE") throw new ErroDeDominio("ESTOURO_JA_DECIDIDO", "Esse pedido já foi respondido ou cancelado.")

  const decisor = nome.trim()
  const texto = observacao?.trim() || null
  await prisma.$transaction(async (tx) => {
    const { count } = await tx.estouroJornada.updateMany({
      where: { id: antes.id, tokenHash, status: "PENDENTE", expiraEm: { gt: agora } },
      data: { status: decisao, decididoEm: agora, decididoPorNome: decisor, observacaoGestor: texto, decisaoIp: ip },
    })
    if (count === 0) throw new ErroDeDominio("ESTOURO_JA_DECIDIDO", "Esse pedido já foi respondido ou cancelado.")
    const depois = await tx.estouroJornada.findUniqueOrThrow({ where: { id: antes.id } })
    // Sem usuário do sistema: o log registra o nome digitado, marcado como "via link".
    await registrarAuditoria(tx, {
      entidade: ENTIDADE,
      entidadeId: antes.id,
      acao: "ATUALIZACAO",
      antes: semToken(antes),
      depois: semToken(depois),
      ator: { usuarioId: "link-estouro", usuarioNome: `${decisor} (via link)` },
      filialId: antes.filialId,
    })
  })
  return { decisao }
}

const CAMPOS_LISTA = {
  id: true,
  status: true,
  expiraEm: true,
  minutosExtras: true,
  motivos: true,
  solicitadoPorNome: true,
  pedidoPeloMotorista: true,
  criadoEm: true,
  decididoEm: true,
  decididoPorNome: true,
  observacaoGestor: true,
  motorista: { select: { nome: true } },
  viagem: { select: { numViagem: true } },
} as const

/** Pedidos dos últimos `dias`, mais recentes primeiro — da filial toda ou só de um motorista. */
export async function buscarEstouros(
  filialId: number,
  dias: number,
  { motoristaId, agora = new Date() }: { motoristaId?: number; agora?: Date } = {},
) {
  const desde = new Date(agora.getTime() - dias * 24 * 60 * 60 * 1000)
  const estouros = await prisma.estouroJornada.findMany({
    where: { filialId, criadoEm: { gte: desde }, ...(motoristaId !== undefined && { motoristaId }) },
    orderBy: { criadoEm: "desc" },
    take: 200,
    select: CAMPOS_LISTA,
  })
  return estouros.map((e) => ({ ...e, situacao: situacaoDoEstouro(e, agora) }))
}

const VIAGEM_ABERTA = { deletadoEm: null, status: { in: [...STATUS_A_INICIAR, ...STATUS_EM_ANDAMENTO] } }
const CAMPOS_VIAGEM = { id: true, numViagem: true, inicioPrevisto: true, motoristaId: true, motoristaAcompanhanteId: true } as const

/** Opções do formulário do escalador: motoristas que viajam e as viagens ainda abertas. */
export async function buscarOpcoesSolicitacao(filialId: number) {
  const [motoristas, viagens] = await Promise.all([
    prisma.motorista.findMany({
      where: { filialId, deletadoEm: null, tipo: { not: "ENCHEDOR" } },
      orderBy: { nome: "asc" },
      select: { id: true, nome: true },
    }),
    prisma.viagem.findMany({ where: { filialId, ...VIAGEM_ABERTA }, orderBy: { inicioPrevisto: "asc" }, select: CAMPOS_VIAGEM }),
  ])
  return { motoristas, viagens }
}

/** Opções do formulário do motorista: só as viagens abertas dele (principal ou acompanhante). */
export async function buscarViagensAbertasDoMotorista(filialId: number, motoristaId: number) {
  return prisma.viagem.findMany({
    where: { filialId, ...VIAGEM_ABERTA, OR: [{ motoristaId }, { motoristaAcompanhanteId: motoristaId }] },
    orderBy: { inicioPrevisto: "asc" },
    select: CAMPOS_VIAGEM,
  })
}

/** A auditoria guarda o antes/depois — sem o hash do token, que não serve pra nada no log. */
function semToken<T extends { tokenHash?: string }>(registro: T): Omit<T, "tokenHash"> {
  const copia: Partial<T> = { ...registro }
  delete copia.tokenHash
  return copia as Omit<T, "tokenHash">
}
