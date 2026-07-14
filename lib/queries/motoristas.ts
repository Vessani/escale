import { prisma } from "@/lib/prisma";
import { Turno } from "@prisma/client";


export async function buscarMotoristas() {
  return await prisma.motorista.findMany({
    where: {
      deletadoEm: null
    },
    orderBy: { nome: 'asc' },
    include: {
      integracao: true,
      viagens: {
        where: {
          deletadoEm: null,
          status: { notIn: ["CANCELADA", "FINALIZADA"] },
        },
        select: {
          id: true,
          inicioPrevisto: true,
          fimPrevisto: true,
          status: true,
          deletadoEm: true,
        },
      },
      // Histórico de jornada: permite projetar o código do motorista na data
      // real de início de cada viagem (ver alocacao.service.ts).
      registrosJornada: {
        orderBy: { data: "asc" },
      },
    },
  });
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
  return await prisma.motorista.findMany({
    where: {
      deletadoEm: null,

      ...(turnoDaViagem ? { turno: turnoDaViagem } : {})
    },
    select: {
      id: true,
      nome: true,
      turno: true,
      diasTrabalhados: true,
      integracao: {
        select: {
          cliente: true,
          status: true,
          dataValidade: true,
        },
      },
      viagens: {
        where: {
          deletadoEm: null,
          status: { notIn: ["CANCELADA", "FINALIZADA"] },
        },
        select: {
          id: true,
          inicioPrevisto: true,
          fimPrevisto: true,
          status: true,
          deletadoEm: true,
        },
      },
      // Histórico de jornada: permite projetar o código do motorista na data
      // real de início de cada viagem (ver alocacao.service.ts).
      registrosJornada: {
        select: { data: true, codigo: true },
        orderBy: { data: "asc" },
      },
    },
    orderBy: { nome: 'asc' }
  });
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