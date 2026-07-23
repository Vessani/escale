import { prisma } from "@/lib/prisma";
import { Prisma, Turno } from "@prisma/client";


/** Mesmo filtro de viagem "ativa" usado nas duas agendas (principal e acompanhante) — ver motivo em buscarMotoristas/buscarMotoristasParaSelect. */
const FILTRO_VIAGEM_ATIVA = {
  deletadoEm: null,
  status: { notIn: ["CANCELADA", "FINALIZADA"] },
} satisfies Prisma.ViagemWhereInput

const SELECT_VIAGEM_AGENDA = {
  id: true,
  inicioPrevisto: true,
  fimPrevisto: true,
  status: true,
  deletadoEm: true,
} as const

export async function buscarMotoristas() {
  const motoristas = await prisma.motorista.findMany({
    where: {
      deletadoEm: null
    },
    orderBy: { nome: 'asc' },
    include: {
      integracao: true,
      viagens: { where: FILTRO_VIAGEM_ATIVA, select: SELECT_VIAGEM_AGENDA },
      // Viagens onde ele é acompanhante também contam como agenda ocupada —
      // unidas com `viagens` abaixo, pra quem aloca (alocacao.service.ts) só
      // precisar considerar "as viagens desse motorista", sem saber do papel.
      viagensComoAcompanhante: { where: FILTRO_VIAGEM_ATIVA, select: SELECT_VIAGEM_AGENDA },
      // Histórico de jornada: permite projetar o código do motorista na data
      // real de início de cada viagem (ver alocacao.service.ts).
      registrosJornada: {
        orderBy: { data: "asc" },
      },
    },
  });

  return motoristas.map(({ viagensComoAcompanhante, ...motorista }) => ({
    ...motorista,
    viagens: [...motorista.viagens, ...viagensComoAcompanhante],
  }))
}


export async function buscarMotoristaPorId(id: number) {
  return await prisma.motorista.findFirst({
    where: {
      id: id,
      deletadoEm: null
    },
    include: {
      integracao: true,
      // Histórico de jornada: permite projetar o código de hoje a partir do
      // registro real mais recente, em vez do cache diasTrabalhados (que só
      // é atualizado quando algo escreve explicitamente no dia de hoje).
      registrosJornada: {
        select: { data: true, codigo: true },
        orderBy: { data: "asc" },
      },
    },
  });
}


export async function buscarMotoristasParaSelect(turnoDaViagem?: Turno) {
  const motoristas = await prisma.motorista.findMany({
    where: {
      deletadoEm: null,

      ...(turnoDaViagem ? { turno: turnoDaViagem } : {})
    },
    select: {
      id: true,
      nome: true,
      turno: true,
      diasTrabalhados: true,
      liberado: true,
      jornadaRelatorioInicio: true,
      jornadaRelatorioFim: true,
      integracao: {
        select: {
          cliente: true,
          status: true,
          dataValidade: true,
        },
      },
      viagens: { where: FILTRO_VIAGEM_ATIVA, select: SELECT_VIAGEM_AGENDA },
      viagensComoAcompanhante: { where: FILTRO_VIAGEM_ATIVA, select: SELECT_VIAGEM_AGENDA },
      // Histórico de jornada: permite projetar o código do motorista na data
      // real de início de cada viagem (ver alocacao.service.ts).
      registrosJornada: {
        select: { data: true, codigo: true },
        orderBy: { data: "asc" },
      },
    },
    orderBy: { nome: 'asc' }
  });

  return motoristas.map(({ viagensComoAcompanhante, ...motorista }) => ({
    ...motorista,
    viagens: [...motorista.viagens, ...viagensComoAcompanhante],
  }))
}

export async function buscarMotoristasComAgenda(inicio: Date, fim: Date) {
  return await prisma.motorista.findMany({
    where: {
      deletadoEm: null,
    },
    orderBy: { nome: "asc" },
    include: {
      integracao: true,
      viagens: {
        where: {
          deletadoEm: null,
          status: { not: "CANCELADA" },
          inicioPrevisto: { lte: fim },
          fimPrevisto: { gte: inicio },
        },
        orderBy: { inicioPrevisto: "asc" },
      },
      // Histórico completo (não só o mês visível): a projeção de um dia sem
      // registro próprio usa o registro conhecido mais próximo, que pode ser
      // de um mês anterior.
      registrosJornada: {
        orderBy: { data: "asc" },
      },
    },
  });
}