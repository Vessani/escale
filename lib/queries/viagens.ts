import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { FiltroStatusViagem } from "@/lib/services/viagem-status.service";
import { fimDoDia, inicioDoDia } from "@/lib/utils/date-format";

// 1. A Busca Principal (Para a tabela de listagem geral)
export async function buscarViagens(filialId: number) {
  return await prisma.viagem.findMany({
    where: {
      deletadoEm: null,
      filialId,
    },
    orderBy: { inicioPrevisto: 'desc' },
    include: {
      entregas: true,
      motorista: true
    },
  });
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