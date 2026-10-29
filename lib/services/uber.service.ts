import type { MotivoUber } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { ErroDeDominio } from "@/lib/errors"
import { registrarAuditoria, type Ator } from "@/lib/services/auditoria.service"
import { CAMINHO_APROVACAO_UBER, montarMensagemUber } from "@/lib/services/uber-regras"
import { montarLinkWhatsApp, situacaoDoPedido } from "@/lib/services/link-aprovacao-regras"
import {
  CAMPOS_PUBLICOS_DO_PEDIDO,
  conferirMotoristaEViagem,
  expiracaoDoLink,
  gerarTokenLink,
  hashDoToken,
  semToken,
  urlDeAprovacao,
  type LinkGerado,
} from "@/lib/services/link-aprovacao"

/**
 * Pedido de Uber aprovado por link — mesmo fluxo do estouro de jornada
 * (estouro-jornada.service.ts): o motorista (na área dele) ou o escalador
 * pede → o link vai pro grupo de WhatsApp da filial → o gestor abre o link,
 * digita o nome e aprova ou recusa → fica gravado quem pediu, quem decidiu,
 * quando, de qual IP e a observação. O sistema só autoriza: a corrida é
 * chamada no app do Uber depois de aprovada.
 *
 * Segurança do link (token, validade, uso único): ver lib/services/link-aprovacao.ts.
 */

const ENTIDADE = "SolicitacaoUber"

type DadosSolicitacao = {
  motoristaId: number
  viagemId: number | null
  origem: string
  destino: string
  motivo: MotivoUber
}

export async function criarSolicitacaoUber(
  filialId: number,
  dados: DadosSolicitacao,
  ator: Ator,
  { pedidoPeloMotorista = false, agora = new Date() }: { pedidoPeloMotorista?: boolean; agora?: Date } = {},
): Promise<LinkGerado> {
  const { motorista, numViagem } = await conferirMotoristaEViagem(filialId, dados.motoristaId, dados.viagemId)

  // Um pedido em aberto por motorista: evita dois links no grupo pra mesma
  // corrida e o gestor aprovar o errado. Link vencido não conta.
  const emAberto = await prisma.solicitacaoUber.findFirst({
    where: { filialId, motoristaId: motorista.id, status: "PENDENTE", expiraEm: { gt: agora } },
    select: { id: true },
  })
  if (emAberto) {
    throw new ErroDeDominio(
      "UBER_JA_PENDENTE",
      "Já existe um pedido de Uber aguardando o gestor pra esse motorista. Cancele ou espere a resposta antes de pedir outro.",
    )
  }

  const { token, tokenHash } = gerarTokenLink()
  const url = urlDeAprovacao(CAMINHO_APROVACAO_UBER, token)

  const pedido = await prisma.$transaction(async (tx) => {
    const criado = await tx.solicitacaoUber.create({
      data: {
        filialId,
        motoristaId: motorista.id,
        viagemId: dados.viagemId,
        origem: dados.origem,
        destino: dados.destino,
        motivo: dados.motivo,
        tokenHash,
        expiraEm: expiracaoDoLink(agora),
        solicitadoPorId: ator.usuarioId,
        solicitadoPorNome: ator.usuarioNome,
        pedidoPeloMotorista,
      },
    })
    await registrarAuditoria(tx, { entidade: ENTIDADE, entidadeId: criado.id, acao: "CRIACAO", depois: semToken(criado), ator, filialId })
    return criado
  })

  const mensagem = montarMensagemUber({ ...pedido, motorista: motorista.nome, numViagem, solicitante: ator.usuarioNome, url })
  return { id: pedido.id, url, linkWhatsApp: montarLinkWhatsApp(mensagem) }
}

/** `doMotorista`: na área do motorista, ele só mexe nos pedidos dele. */
function filtroPedido(filialId: number, id: number, doMotorista?: number) {
  return { id, filialId, ...(doMotorista !== undefined && { motoristaId: doMotorista }) }
}

/** Link novo pra um pedido ainda pendente (o anterior venceu, ou a pessoa fechou a tela sem enviar). O antigo deixa de valer. */
export async function gerarNovoLinkUber(
  filialId: number,
  id: number,
  ator: Ator,
  { doMotorista, agora = new Date() }: { doMotorista?: number; agora?: Date } = {},
): Promise<LinkGerado> {
  const filtro = filtroPedido(filialId, id, doMotorista)
  const antes = await prisma.solicitacaoUber.findFirst({
    where: filtro,
    include: { motorista: { select: { nome: true } }, viagem: { select: { numViagem: true } } },
  })
  if (!antes) throw new ErroDeDominio("UBER_NAO_ENCONTRADO", "Pedido de Uber não encontrado.")
  if (antes.status !== "PENDENTE")
    throw new ErroDeDominio("UBER_JA_DECIDIDO", "Esse pedido já foi encerrado — não dá pra gerar outro link.")

  const { token, tokenHash } = gerarTokenLink()
  const url = urlDeAprovacao(CAMINHO_APROVACAO_UBER, token)

  await prisma.$transaction(async (tx) => {
    const { count } = await tx.solicitacaoUber.updateMany({
      where: { ...filtro, status: "PENDENTE" },
      data: { tokenHash, expiraEm: expiracaoDoLink(agora) },
    })
    if (count === 0) throw new ErroDeDominio("UBER_MUDOU", "O pedido foi respondido nesse meio-tempo. Atualize a tela.")
    const depois = await tx.solicitacaoUber.findUniqueOrThrow({ where: { id } })
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

  const mensagem = montarMensagemUber({
    ...antes,
    motorista: antes.motorista.nome,
    numViagem: antes.viagem?.numViagem ?? null,
    solicitante: ator.usuarioNome,
    url,
  })
  return { id, url, linkWhatsApp: montarLinkWhatsApp(mensagem) }
}

export async function cancelarSolicitacaoUber(filialId: number, id: number, ator: Ator, { doMotorista }: { doMotorista?: number } = {}) {
  const filtro = filtroPedido(filialId, id, doMotorista)
  await prisma.$transaction(async (tx) => {
    const antes = await tx.solicitacaoUber.findFirst({ where: filtro })
    if (!antes) throw new ErroDeDominio("UBER_NAO_ENCONTRADO", "Pedido de Uber não encontrado.")
    const { count } = await tx.solicitacaoUber.updateMany({ where: { ...filtro, status: "PENDENTE" }, data: { status: "CANCELADO" } })
    if (count === 0) throw new ErroDeDominio("UBER_JA_DECIDIDO", "Esse pedido já foi respondido pelo gestor ou cancelado.")
    const depois = await tx.solicitacaoUber.findUniqueOrThrow({ where: { id } })
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
export async function buscarUberPorToken(token: string, agora = new Date()) {
  const pedido = await prisma.solicitacaoUber.findUnique({
    where: { tokenHash: hashDoToken(token) },
    select: { ...CAMPOS_PUBLICOS_DO_PEDIDO, origem: true, destino: true, motivo: true },
  })
  if (!pedido) return null
  return { ...pedido, situacao: situacaoDoPedido(pedido, agora) }
}

/**
 * A decisão pelo link. Só vale uma vez e só dentro da validade: o
 * updateMany com status PENDENTE + expiraEm no futuro garante isso mesmo com
 * dois cliques simultâneos (só um muda a linha).
 */
export async function decidirUberPorToken(
  token: string,
  decisao: "APROVADO" | "RECUSADO",
  { nome, observacao, ip }: { nome: string; observacao?: string; ip: string | null },
  agora = new Date(),
) {
  const tokenHash = hashDoToken(token)
  const antes = await prisma.solicitacaoUber.findUnique({ where: { tokenHash } })
  if (!antes) throw new ErroDeDominio("LINK_INVALIDO", "Link inválido ou substituído por um mais novo. Peça um novo link a quem pediu.")

  const situacao = situacaoDoPedido(antes, agora)
  if (situacao === "EXPIRADO") throw new ErroDeDominio("LINK_EXPIRADO", "Esse link expirou. Peça um novo a quem pediu.")
  if (situacao !== "PENDENTE") throw new ErroDeDominio("UBER_JA_DECIDIDO", "Esse pedido já foi respondido ou cancelado.")

  const decisor = nome.trim()
  const texto = observacao?.trim() || null
  await prisma.$transaction(async (tx) => {
    const { count } = await tx.solicitacaoUber.updateMany({
      where: { id: antes.id, tokenHash, status: "PENDENTE", expiraEm: { gt: agora } },
      data: { status: decisao, decididoEm: agora, decididoPorNome: decisor, observacaoGestor: texto, decisaoIp: ip },
    })
    if (count === 0) throw new ErroDeDominio("UBER_JA_DECIDIDO", "Esse pedido já foi respondido ou cancelado.")
    const depois = await tx.solicitacaoUber.findUniqueOrThrow({ where: { id: antes.id } })
    // Sem usuário do sistema: o log registra o nome digitado, marcado como "via link".
    await registrarAuditoria(tx, {
      entidade: ENTIDADE,
      entidadeId: antes.id,
      acao: "ATUALIZACAO",
      antes: semToken(antes),
      depois: semToken(depois),
      ator: { usuarioId: "link-uber", usuarioNome: `${decisor} (via link)` },
      filialId: antes.filialId,
    })
  })
  return { decisao }
}

/** Pedidos dos últimos `dias`, mais recentes primeiro — da filial toda ou só de um motorista. */
export async function buscarSolicitacoesUber(
  filialId: number,
  dias: number,
  { motoristaId, agora = new Date() }: { motoristaId?: number; agora?: Date } = {},
) {
  const desde = new Date(agora.getTime() - dias * 24 * 60 * 60 * 1000)
  const pedidos = await prisma.solicitacaoUber.findMany({
    where: { filialId, criadoEm: { gte: desde }, ...(motoristaId !== undefined && { motoristaId }) },
    orderBy: { criadoEm: "desc" },
    take: 200,
    select: {
      id: true,
      status: true,
      expiraEm: true,
      origem: true,
      destino: true,
      motivo: true,
      solicitadoPorNome: true,
      pedidoPeloMotorista: true,
      criadoEm: true,
      decididoEm: true,
      decididoPorNome: true,
      observacaoGestor: true,
      motorista: { select: { nome: true } },
      viagem: { select: { numViagem: true } },
    },
  })
  return pedidos.map((p) => ({ ...p, situacao: situacaoDoPedido(p, agora) }))
}
