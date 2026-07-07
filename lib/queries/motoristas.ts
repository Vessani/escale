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
    },
  });
}


export async function buscarMotoristaPorId(id: number) {
  return await prisma.motorista.findFirst({
    where: { 
      id: id,
      deletadoEm: null
    },
    include: { integracao: true },
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
    },
  });
}