import { prisma } from "@/lib/prisma";
import type { FiltroStatusViagem } from "@/lib/services/viagem-status.service";
import { fimDoDia, inicioDoDia } from "@/lib/utils/date-format";

// 1. A Busca Principal (Para a tabela de listagem geral)
export async function buscarViagens() {
  return await prisma.viagem.findMany({
    where: { 
      deletadoEm: null 
    },
    orderBy: { inicioPrevisto: 'desc' },
    include: { 
      entregas: true,
      motorista: true 
    },
  });
}


export async function buscarViagemPorId(id: number) {
  return await prisma.viagem.findFirst({
    where: { 
      id: id,
      deletadoEm: null 
    },
    include: { 
      entregas: true,
      motorista: true
    },
  });
}


export async function buscarViagensSemMotorista() {
  return await prisma.viagem.findMany({
    where: {
      deletadoEm: null,
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
 * sumir da tela só porque começou em um dia anterior. `filtroStatus` estreita
 * ainda mais esse conjunto quando não é "TODOS".
 */
export async function buscarViagensDoDashboard(hoje: Date, filtroStatus: FiltroStatusViagem) {
  const inicioHoje = inicioDoDia(hoje);
  const fimHoje = fimDoDia(hoje);

  return await prisma.viagem.findMany({
    where: {
      deletadoEm: null,
      OR: [
        { inicioPrevisto: { lte: fimHoje }, fimPrevisto: { gte: inicioHoje } },
        { status: "RETORNANDO" },
      ],
      ...(filtroStatus === "TODOS" ? {} : { status: filtroStatus }),
    },
    orderBy: { inicioPrevisto: "asc" },
    include: {
      entregas: true,
      motorista: true,
    },
  });
}