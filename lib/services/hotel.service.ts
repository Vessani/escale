import { prisma } from "@/lib/prisma"
import { ErroDeDominio } from "@/lib/errors"
import { registrarAuditoria, type Ator } from "@/lib/services/auditoria.service"
import {
  CAMINHO_APROVACAO_HOTEL,
  DIAS_MAXIMOS_ANTECEDENCIA_HOTEL,
  diaEmBrasilia,
  montarMensagemHotel,
  parseDataPernoite,
} from "@/lib/services/hotel-regras"
import { montarLinkWhatsApp, situacaoDoPedido } from "@/lib/services/link-aprovacao-regras"
import {
  CAMPOS_PUBLICOS_DO_PEDIDO,
  CAMPOS_VIAGEM_DA_MENSAGEM,
  conferirMotoristaEViagem,
  expiracaoDoLink,
  gerarTokenLink,
  hashDoToken,
  semToken,
  urlDeAprovacao,
  type LinkGerado,
} from "@/lib/services/link-aprovacao"

/**
 * Pedido de hotel pro pernoite aprovado por link — mesmo fluxo do Uber e do
 * estouro de jornada (uber.service.ts, estouro-jornada.service.ts): o
 * motorista (na área dele) ou o escalador informa a cidade e o hotel → o link
 * vai pro grupo de WhatsApp da filial → o gestor abre o link, digita o nome e
 * aprova ou recusa → fica gravado quem pediu, quem decidiu, quando, de qual
 * IP e a observação. O sistema só autoriza: a reserva é feita fora depois de
 * aprovada.
 *
 * Segurança do link (token, validade, uso único): ver lib/services/link-aprovacao.ts.
 */

const ENTIDADE = "SolicitacaoHotel"

type DadosSolicitacao = {
  motoristaId: number
  viagemId: number | null
  cidade: string
  nomeHotel: string
  /** "AAAA-MM-DD". */
  dataPernoite: string
}

/** O pernoite tem de ser de ontem (pedido feito de madrugada) até DIAS_MAXIMOS_ANTECEDENCIA_HOTEL dias pra frente. */
function conferirDataPernoite(dataPernoite: string, agora: Date) {
  // Texto "AAAA-MM-DD" compara certo em ordem alfabética.
  if (dataPernoite < diaEmBrasilia(agora, -1)) {
    throw new ErroDeDominio("HOTEL_DATA_PASSADA", "A data do pernoite já passou.")
  }
  if (dataPernoite > diaEmBrasilia(agora, DIAS_MAXIMOS_ANTECEDENCIA_HOTEL)) {
    throw new ErroDeDominio("HOTEL_DATA_DISTANTE", `Peça o hotel com até ${DIAS_MAXIMOS_ANTECEDENCIA_HOTEL} dias de antecedência.`)
  }
}

export async function criarSolicitacaoHotel(
  filialId: number,
  dados: DadosSolicitacao,
  ator: Ator,
  { pedidoPeloMotorista = false, agora = new Date() }: { pedidoPeloMotorista?: boolean; agora?: Date } = {},
): Promise<LinkGerado> {
  conferirDataPernoite(dados.dataPernoite, agora)
  const { motorista, viagem } = await conferirMotoristaEViagem(filialId, dados.motoristaId, dados.viagemId)

  // Um pedido em aberto por motorista: evita dois links no grupo pro mesmo
  // pernoite e o gestor aprovar o errado. Link vencido não conta.
  const emAberto = await prisma.solicitacaoHotel.findFirst({
    where: { filialId, motoristaId: motorista.id, status: "PENDENTE", expiraEm: { gt: agora } },
    select: { id: true },
  })
  if (emAberto) {
    throw new ErroDeDominio(
      "HOTEL_JA_PENDENTE",
      "Já existe um pedido de hotel aguardando o gestor pra esse motorista. Cancele ou espere a resposta antes de pedir outro.",
    )
  }

  const { token, tokenHash } = gerarTokenLink()
  const url = urlDeAprovacao(CAMINHO_APROVACAO_HOTEL, token)

  const pedido = await prisma.$transaction(async (tx) => {
    const criado = await tx.solicitacaoHotel.create({
      data: {
        filialId,
        motoristaId: motorista.id,
        viagemId: dados.viagemId,
        cidade: dados.cidade,
        nomeHotel: dados.nomeHotel,
        dataPernoite: parseDataPernoite(dados.dataPernoite),
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

  const mensagem = montarMensagemHotel({ ...pedido, motorista: motorista.nome, viagem, solicitante: ator.usuarioNome, url })
  return { id: pedido.id, url, linkWhatsApp: montarLinkWhatsApp(mensagem) }
}

/** `doMotorista`: na área do motorista, ele só mexe nos pedidos dele. */
function filtroPedido(filialId: number, id: number, doMotorista?: number) {
  return { id, filialId, ...(doMotorista !== undefined && { motoristaId: doMotorista }) }
}

/** Link novo pra um pedido ainda pendente (o anterior venceu, ou a pessoa fechou a tela sem enviar). O antigo deixa de valer. */
export async function gerarNovoLinkHotel(
  filialId: number,
  id: number,
  ator: Ator,
  { doMotorista, agora = new Date() }: { doMotorista?: number; agora?: Date } = {},
): Promise<LinkGerado> {
  const filtro = filtroPedido(filialId, id, doMotorista)
  const antes = await prisma.solicitacaoHotel.findFirst({
    where: filtro,
    include: { motorista: { select: { nome: true } }, viagem: { select: CAMPOS_VIAGEM_DA_MENSAGEM } },
  })
  if (!antes) throw new ErroDeDominio("HOTEL_NAO_ENCONTRADO", "Pedido de hotel não encontrado.")
  if (antes.status !== "PENDENTE")
    throw new ErroDeDominio("HOTEL_JA_DECIDIDO", "Esse pedido já foi encerrado — não dá pra gerar outro link.")

  const { token, tokenHash } = gerarTokenLink()
  const url = urlDeAprovacao(CAMINHO_APROVACAO_HOTEL, token)

  await prisma.$transaction(async (tx) => {
    const { count } = await tx.solicitacaoHotel.updateMany({
      where: { ...filtro, status: "PENDENTE" },
      data: { tokenHash, expiraEm: expiracaoDoLink(agora) },
    })
    if (count === 0) throw new ErroDeDominio("HOTEL_MUDOU", "O pedido foi respondido nesse meio-tempo. Atualize a tela.")
    const depois = await tx.solicitacaoHotel.findUniqueOrThrow({ where: { id } })
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

  const mensagem = montarMensagemHotel({
    ...antes,
    motorista: antes.motorista.nome,
    viagem: antes.viagem,
    solicitante: ator.usuarioNome,
    url,
  })
  return { id, url, linkWhatsApp: montarLinkWhatsApp(mensagem) }
}

export async function cancelarSolicitacaoHotel(filialId: number, id: number, ator: Ator, { doMotorista }: { doMotorista?: number } = {}) {
  const filtro = filtroPedido(filialId, id, doMotorista)
  await prisma.$transaction(async (tx) => {
    const antes = await tx.solicitacaoHotel.findFirst({ where: filtro })
    if (!antes) throw new ErroDeDominio("HOTEL_NAO_ENCONTRADO", "Pedido de hotel não encontrado.")
    const { count } = await tx.solicitacaoHotel.updateMany({ where: { ...filtro, status: "PENDENTE" }, data: { status: "CANCELADO" } })
    if (count === 0) throw new ErroDeDominio("HOTEL_JA_DECIDIDO", "Esse pedido já foi respondido pelo gestor ou cancelado.")
    const depois = await tx.solicitacaoHotel.findUniqueOrThrow({ where: { id } })
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
export async function buscarHotelPorToken(token: string, agora = new Date()) {
  const pedido = await prisma.solicitacaoHotel.findUnique({
    where: { tokenHash: hashDoToken(token) },
    select: { ...CAMPOS_PUBLICOS_DO_PEDIDO, cidade: true, nomeHotel: true, dataPernoite: true },
  })
  if (!pedido) return null
  return { ...pedido, situacao: situacaoDoPedido(pedido, agora) }
}

/**
 * A decisão pelo link. Só vale uma vez e só dentro da validade: o
 * updateMany com status PENDENTE + expiraEm no futuro garante isso mesmo com
 * dois cliques simultâneos (só um muda a linha).
 */
export async function decidirHotelPorToken(
  token: string,
  decisao: "APROVADO" | "RECUSADO",
  { nome, observacao, ip }: { nome: string; observacao?: string; ip: string | null },
  agora = new Date(),
) {
  const tokenHash = hashDoToken(token)
  const antes = await prisma.solicitacaoHotel.findUnique({ where: { tokenHash } })
  if (!antes) throw new ErroDeDominio("LINK_INVALIDO", "Link inválido ou substituído por um mais novo. Peça um novo link a quem pediu.")

  const situacao = situacaoDoPedido(antes, agora)
  if (situacao === "EXPIRADO") throw new ErroDeDominio("LINK_EXPIRADO", "Esse link expirou. Peça um novo a quem pediu.")
  if (situacao !== "PENDENTE") throw new ErroDeDominio("HOTEL_JA_DECIDIDO", "Esse pedido já foi respondido ou cancelado.")

  const decisor = nome.trim()
  const texto = observacao?.trim() || null
  await prisma.$transaction(async (tx) => {
    const { count } = await tx.solicitacaoHotel.updateMany({
      where: { id: antes.id, tokenHash, status: "PENDENTE", expiraEm: { gt: agora } },
      data: { status: decisao, decididoEm: agora, decididoPorNome: decisor, observacaoGestor: texto, decisaoIp: ip },
    })
    if (count === 0) throw new ErroDeDominio("HOTEL_JA_DECIDIDO", "Esse pedido já foi respondido ou cancelado.")
    const depois = await tx.solicitacaoHotel.findUniqueOrThrow({ where: { id: antes.id } })
    // Sem usuário do sistema: o log registra o nome digitado, marcado como "via link".
    await registrarAuditoria(tx, {
      entidade: ENTIDADE,
      entidadeId: antes.id,
      acao: "ATUALIZACAO",
      antes: semToken(antes),
      depois: semToken(depois),
      ator: { usuarioId: "link-hotel", usuarioNome: `${decisor} (via link)` },
      filialId: antes.filialId,
    })
  })
  return { decisao }
}

/** Pedidos dos últimos `dias`, mais recentes primeiro — da filial toda ou só de um motorista. */
export async function buscarSolicitacoesHotel(
  filialId: number,
  dias: number,
  { motoristaId, agora = new Date() }: { motoristaId?: number; agora?: Date } = {},
) {
  const desde = new Date(agora.getTime() - dias * 24 * 60 * 60 * 1000)
  const pedidos = await prisma.solicitacaoHotel.findMany({
    where: { filialId, criadoEm: { gte: desde }, ...(motoristaId !== undefined && { motoristaId }) },
    orderBy: { criadoEm: "desc" },
    take: 200,
    select: {
      id: true,
      status: true,
      expiraEm: true,
      cidade: true,
      nomeHotel: true,
      dataPernoite: true,
      solicitadoPorNome: true,
      pedidoPeloMotorista: true,
      criadoEm: true,
      decididoEm: true,
      decididoPorNome: true,
      observacaoGestor: true,
      motorista: { select: { nome: true } },
      viagem: { select: CAMPOS_VIAGEM_DA_MENSAGEM },
    },
  })
  return pedidos.map((p) => ({ ...p, situacao: situacaoDoPedido(p, agora) }))
}
