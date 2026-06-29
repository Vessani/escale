import { prisma } from "@/lib/prisma";
import { Turno } from "@prisma/client";


export async function buscarMotoristas() {
  return await prisma.motorista.findMany({
    where: { 
      deletadoEm: null
    },
    orderBy: { nome: 'asc' },
    include: { integracao: true },
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
      turno: true
    },
    orderBy: { nome: 'asc' }
  });
}