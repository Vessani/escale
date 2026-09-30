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
      motoristaAcompanhante: true
    },
  });
}


export async function buscarViagensSemMotorista(filialId: number) {
  return await prisma.viagem.findMany({
    where: {
      deletadoEm: null,
      filialId,
      status: 'CRIADA'
    },
    orderBy: { inicioPrevisto: 'asc' },
    include: {
      entregas: true
    },
  });
}

/**
 * Viagens do painel do Dashboard: qualquer status com atividade hoje (usa o
 * mesmo critério de sobreposição de `reconciliarFolgaMotoristasNoDiaAtual`),
 * mais qualquer viagem "Retornando" independente da data — ela não pode
 * sumir da tela só porque começou em um dia anterior — mais qualquer
 * "Cancelada" no mesmo dia em que foi cancelada (`canceladoEm`), mesmo que a
 * janela original da viagem já tenha passado. `filtroStatus` estreita ainda
 * mais esse conjunto quando não é "TODOS"; na visão padrão ("TODOS"),
 * "Finalizada" já sai da tela na hora, em vez de esperar a virada do dia.
 */
export async function buscarViagensDoDashboard(filialId: number, hoje: Date, filtroStatus: FiltroStatusViagem) {
  const inicioHoje = inicioDoDia(hoje);
  const fimHoje = fimDoDia(hoje);

  const janelaOuAtividadeRecente = {
    OR: [
      { inicioPrevisto: { lte: fimHoje }, fimPrevisto: { gte: inicioHoje } },
      { status: "RETORNANDO" },
      { status: "CANCELADA", canceladoEm: { gte: inicioHoje, lte: fimHoje } },
    ],
  } satisfies Prisma.ViagemWhereInput;

  const filtroStatusExplicito = filtroStatus === "TODOS"
    ? ({ status: { not: "FINALIZADA" } } satisfies Prisma.ViagemWhereInput)
    : ({ status: filtroStatus } satisfies Prisma.ViagemWhereInput);

  return await prisma.viagem.findMany({
    where: {
      deletadoEm: null,
      filialId,
      ...janelaOuAtividadeRecente,
      ...filtroStatusExplicito,
    },
    orderBy: { inicioPrevisto: "asc" },
    include: {
      entregas: true,
      motorista: true,
      motoristaAcompanhante: true,
    },
  });
}

/**
 * Relatório geral: viagens de qualquer status, opcionalmente filtradas por
 * status e por janela de início previsto — usado pelo Excel de
 * viagem+motorista+frota cruzados (ver excel-export.service.ts).
 */
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
      // Só sapcode — é o que decide se uma entrega conta no resumo do
      // relatório (ver gerarExcelViagensCriadasHoje).
      entregas: { select: { sapcode: true } },
    },
  });
}