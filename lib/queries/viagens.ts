import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { FiltroStatusViagem } from "@/lib/services/viagem-status.service";
import { fimDoDia, inicioDoDia } from "@/lib/utils/date-format";
import { VIAGENS_POR_PAGINA, type FiltroListaViagens } from "@/lib/services/filtro-viagens";

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
      deletadoEm: null
    },
    include: {
      entregas: true,
      motorista: true,
      motoristaAcompanhante: true,
      despesas: { where: { deletadoEm: null }, orderBy: { registradoEm: "asc" } },
    },
  });
}


export async function buscarViagensSemMotorista(filialId: number) {
  return await prisma.viagem.findMany({
    where: {
      deletadoEm: null,
      filialId,
      status: 'CRIADA',
      motoristaId: null,
    },
    orderBy: { inicioPrevisto: 'asc' },
    include: {
      entregas: true
    },
  });
}

/**
 * Viagens do painel do Dashboard (só leitura, fora saída real e status):
 * qualquer status com atividade no dia (mesmo critério de sobreposição de
 * `reconciliarFolgaMotoristasNoDiaAtual`), mais qualquer "Retornando"
 * independente da data — ela não pode sumir só porque começou num dia
 * anterior — mais Canceladas e Finalizadas NAQUELE dia (canceladoEm /
 * finalizadoEm), mesmo que a janela original da viagem já tenha passado.
 *
 * Traz todos os status de uma vez: o filtro por status e as contagens dos
 * botões saem da mesma lista, na página (antes a visão "Todos" escondia as
 * Finalizadas e as contagens só apareciam às vezes).
 */
export async function buscarViagensDoDashboard(filialId: number, hoje: Date) {
  const inicioHoje = inicioDoDia(hoje);
  const fimHoje = fimDoDia(hoje);

  return await prisma.viagem.findMany({
    where: {
      deletadoEm: null,
      filialId,
      OR: [
        { inicioPrevisto: { lte: fimHoje }, fimPrevisto: { gte: inicioHoje } },
        { status: "RETORNANDO" },
        { status: "CANCELADA", canceladoEm: { gte: inicioHoje, lte: fimHoje } },
        { status: "FINALIZADA", finalizadoEm: { gte: inicioHoje, lte: fimHoje } },
      ],
    },
    orderBy: { inicioPrevisto: "asc" },
    include: {
      // Ordem de cadastro = ordem da rota; o painel de destinos mostra cidade, cliente e horário de cada entrega.
      entregas: { select: { cidade: true, uf: true, cliente: true, dataEntrega: true }, orderBy: { id: "asc" } },
      motorista: { select: { nome: true, tipo: true } },
      motoristaAcompanhante: { select: { nome: true, tipo: true } },
    },
  });
}

export async function buscarViagensParaRelatorioGeral(
  filialId: number,
  filtros: { status?: FiltroStatusViagem; de?: Date; ate?: Date },
) {
  const filtroStatus =
    filtros.status && filtros.status !== "TODOS"
      ? ({ status: filtros.status } satisfies Prisma.ViagemWhereInput)
      : {};

  const filtroPeriodo: Prisma.ViagemWhereInput = {};
  if (filtros.de) filtroPeriodo.inicioPrevisto = { gte: filtros.de };
  if (filtros.ate) {
    filtroPeriodo.fimPrevisto = { lte: fimDoDia(filtros.ate) };
  }

  return await prisma.viagem.findMany({
    where: {
      deletadoEm: null,
      filialId,
      ...filtroStatus,
      ...filtroPeriodo,
    },
    orderBy: { inicioPrevisto: "desc" },
    include: {
      motorista: true,
      motoristaAcompanhante: true,
      entregas: { select: { cidade: true, cliente: true, sapcode: true, kg: true }, orderBy: { id: "asc" } },
    },
  });
}

/**
 * Viagens de um motorista específico com status ALOCADA/INICIADA/RETORNANDO
 * — pra montar o Excel individual que é enviado direto pra ele (ver plano,
 * seção "3 relatórios").
 */
export async function buscarViagensPorMotorista(filialId: number, motoristaId: number) {
  return await prisma.viagem.findMany({
    where: {
      deletadoEm: null,
      filialId,
      motoristaId,
      status: { in: ["ALOCADA", "INICIADA", "RETORNANDO"] },
    },
    orderBy: { inicioPrevisto: "asc" },
    include: {
      motorista: true,
      motoristaAcompanhante: true,
      entregas: { select: { cidade: true, cliente: true, sapcode: true, kg: true }, orderBy: { id: "asc" } },
    },
  });
}

/**
 * Viagens criadas (criadoEm) num dia específico — pra montar o Excel enviado
 * pra operação com o que entrou no sistema naquele dia.
 */
export async function buscarViagensCriadasEm(filialId: number, data: Date) {
  return await prisma.viagem.findMany({
    where: {
      deletadoEm: null,
      filialId,
      criadoEm: { gte: inicioDoDia(data), lte: fimDoDia(data) },
    },
    orderBy: { inicioPrevisto: "asc" },
    include: {
      motorista: true,
      motoristaAcompanhante: true,
      // sapcode decide se a entrega conta no resumo (ver
      // gerarExcelViagensCriadasHoje); cidade/cliente montam a rota.
      entregas: { select: { cidade: true, cliente: true, sapcode: true, kg: true }, orderBy: { id: "asc" } },
    },
  });
}
/**
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
  });
}

/** Chegadas do motorista nos clientes desta viagem (a viagem já foi conferida na filial por quem chama). */
export async function buscarChegadasDaViagem(viagemId: number) {
  const chegadas = await prisma.chegadaEntrega.findMany({
    where: { entrega: { viagemId } },
    orderBy: { entregaId: "asc" },
    include: { entrega: { select: { cliente: true, cidade: true, uf: true } } },
  })
  return chegadas.map((chegada) => ({
    id: chegada.id,
    cliente: chegada.entrega.cliente,
    cidade: chegada.entrega.cidade,
    uf: chegada.entrega.uf,
    km: chegada.km,
    chegadaEm: chegada.chegadaEm,
    medicao: chegada.medicao,
    nivelInicial: Number(chegada.nivelInicial),
    nivelFinal: Number(chegada.nivelFinal),
    polInicial: chegada.polInicial === null ? null : Number(chegada.polInicial),
    polFinal: chegada.polFinal === null ? null : Number(chegada.polFinal),
    fator: chegada.fator === null ? null : Number(chegada.fator),
    totalDescarregado: Number(chegada.totalDescarregado),
  }))
}

