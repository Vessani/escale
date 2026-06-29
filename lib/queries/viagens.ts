import { prisma } from "@/lib/prisma";

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