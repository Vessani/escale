import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { chegadaEmNumeros } from "@/lib/services/descarga"
import { STATUS_A_INICIAR, STATUS_EM_ANDAMENTO } from "@/lib/services/viagem-status.service"
import { DIAS_NAO_SAIU_NO_DASHBOARD } from "@/lib/services/dashboard.service"

const UM_DIA_MS = 24 * 60 * 60 * 1000
import { fimDoDia, inicioDoDia } from "@/lib/utils/date-format"
import { VIAGENS_POR_PAGINA, type FiltroListaViagens } from "@/lib/services/filtro-viagens"
import { soEntregasDeCliente } from "@/lib/services/entrega-cliente"

/**
 * Lista da Gestão de Viagens, paginada e filtrada no banco (ver
 * parseFiltroListaViagens). Antes a tela carregava TODAS as viagens da
 * filial desde sempre, com todas as entregas — com um ano de dados eram
 * ~11 mil viagens e uma página de centenas de MB. Traz só os campos que a
 * lista mostra (sem entregas) e o total, pra paginação.
 */
export async function buscarViagensPaginadas(filialId: number, filtro: FiltroListaViagens) {
  const where: Prisma.ViagemWhereInput = {
    deletadoEm: null,
    filialId,
    ...(filtro.status !== "TODOS" ? { status: filtro.status } : {}),
    ...(filtro.busca
      ? { numViagem: { contains: filtro.busca, mode: "insensitive" } }
      : {
          // Sobreposição com o período: começa antes do fim dele e termina
          // depois do começo (pega também viagem longa que atravessa o período).
          inicioPrevisto: { lte: fimDoDia(filtro.ate) },
          fimPrevisto: { gte: filtro.de },
        }),
  }

  const [viagens, total] = await Promise.all([
    prisma.viagem.findMany({
      where,
      orderBy: [{ inicioPrevisto: "desc" }, { id: "desc" }],
      skip: (filtro.pagina - 1) * VIAGENS_POR_PAGINA,
      take: VIAGENS_POR_PAGINA,
      select: {
        id: true,
        numViagem: true,
        cavalo: true,
        carreta: true,
        inicioPrevisto: true,
        fimPrevisto: true,
        turno: true,
        status: true,
        viagemExtra: true,
        avisoInterjornada: true,
        avisoRelatorioJornada: true,
        avisoFrotaIndisponivel: true,
        avisoFrotaProdutoIncompativel: true,
        motorista: { select: { nome: true, tipo: true } },
      },
    }),
    prisma.viagem.count({ where }),
  ])

  return { viagens, total, totalPaginas: Math.max(1, Math.ceil(total / VIAGENS_POR_PAGINA)) }
}

export async function buscarViagemPorId(filialId: number, id: number) {
  return await prisma.viagem.findFirst({
    where: {
      id: id,
      filialId,
      deletadoEm: null,
    },
    include: {
      entregas: true,
      motorista: true,
      motoristaAcompanhante: true,
    },
  })
}

export async function buscarViagensSemMotorista(filialId: number) {
  return await prisma.viagem.findMany({
    where: {
      deletadoEm: null,
      filialId,
      status: "CRIADA",
      motoristaId: null,
    },
    orderBy: { inicioPrevisto: "asc" },
    include: {
      entregas: true,
    },
  })
}

/**
 * Viagens do painel do Dashboard (só leitura, fora saída real e status):
 * qualquer status com atividade no dia (mesmo critério de sobreposição de
 * `reconciliarFolgaMotoristasNoDiaAtual`), mais Iniciada/Retornando de
 * dias anteriores — não podem sumir só porque o fim previsto passou — e as
 * que não saíram quando deviam (últimos 30 dias, ver
 * DIAS_NAO_SAIU_NO_DASHBOARD), mais Canceladas e Finalizadas NAQUELE dia (canceladoEm /
 * finalizadoEm), mesmo que a janela original da viagem já tenha passado.
 *
 * Traz todos os status de uma vez: o filtro por status e as contagens dos
 * botões saem da mesma lista, na página (antes a visão "Todos" escondia as
 * Finalizadas e as contagens só apareciam às vezes).
 */
export async function buscarViagensDoDashboard(filialId: number, hoje: Date) {
  const inicioHoje = inicioDoDia(hoje)
  const fimHoje = fimDoDia(hoje)

  const viagens = await prisma.viagem.findMany({
    where: {
      deletadoEm: null,
      filialId,
      OR: [
        { inicioPrevisto: { lte: fimHoje }, fimPrevisto: { gte: inicioHoje } },
        // Em andamento de dias anteriores fica até encerrar (mesmo com o fim previsto já passado).
        { status: { in: STATUS_EM_ANDAMENTO }, inicioPrevisto: { lte: fimHoje } },
        // Não saiu e era pra ter saído antes: pendência pro escalador resolver.
        {
          status: { in: STATUS_A_INICIAR },
          inicioPrevisto: { gte: new Date(inicioHoje.getTime() - DIAS_NAO_SAIU_NO_DASHBOARD * UM_DIA_MS), lt: inicioHoje },
        },
        { status: "CANCELADA", canceladoEm: { gte: inicioHoje, lte: fimHoje } },
        { status: "FINALIZADA", finalizadoEm: { gte: inicioHoje, lte: fimHoje } },
      ],
    },
    orderBy: { inicioPrevisto: "asc" },
    include: {
      // Ordem de cadastro = ordem da rota; o painel de destinos mostra cidade, cliente e horário de cada entrega.
      entregas: {
        select: { cidade: true, uf: true, cliente: true, dataEntrega: true, sapcode: true, codewhite: true },
        orderBy: { id: "asc" },
      },
      motorista: { select: { nome: true, tipo: true } },
      motoristaAcompanhante: { select: { nome: true, tipo: true } },
    },
  })
  // Só clientes (SAP code + número white): a origem não é parada nem conta como entrega no resumo do turno.
  return viagens.map((viagem) => ({ ...viagem, entregas: soEntregasDeCliente(viagem.entregas) }))
} /**
 * Programação do dia: viagens previstas pra começar no dia (horário de
 * Brasília), em qualquer status, com motorista, acompanhante e entregas
 * completas — base do Excel "Programação do dia".
 */
export async function buscarProgramacaoDoDia(filialId: number, dia: Date) {
  return await prisma.viagem.findMany({
    where: {
      deletadoEm: null,
      filialId,
      inicioPrevisto: { gte: inicioDoDia(dia), lte: fimDoDia(dia) },
    },
    orderBy: { inicioPrevisto: "asc" },
    include: {
      motorista: { select: { nome: true } },
      motoristaAcompanhante: { select: { nome: true } },
      entregas: { orderBy: { id: "asc" } },
    },
  })
}

/** Chegadas do motorista nos clientes desta viagem (escopo pela filial). */
export async function buscarChegadasDaViagem(filialId: number, viagemId: number) {
  const chegadas = await prisma.chegadaEntrega.findMany({
    where: { entrega: { viagemId, viagem: { filialId } } },
    orderBy: { entregaId: "asc" },
    include: { entrega: { select: { cliente: true, cidade: true, uf: true } } },
  })
  return chegadas.map(({ entrega, ...chegada }) => ({
    ...chegadaEmNumeros(chegada),
    cliente: entrega.cliente,
    cidade: entrega.cidade,
    uf: entrega.uf,
  }))
}

/** Pedágios e pernoites ativos da viagem (escopo pela filial). */
export async function buscarDespesasDaViagem(filialId: number, viagemId: number) {
  return prisma.despesaViagem.findMany({
    where: { viagemId, deletadoEm: null, viagem: { filialId } },
    orderBy: { registradoEm: "asc" },
  })
}
