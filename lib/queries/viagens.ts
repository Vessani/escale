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

/**
 * Viagens em andamento — painel do Dashboard. Não exige horarioRealSaida
 * preenchido: é justamente lá que o horário real e o motivo de atraso são
 * registrados (ver AtualizarSaidaReal), então a viagem precisa aparecer antes
 * disso ser preenchido.
 */
export async function buscarViagensEmAndamento() {
  return await prisma.viagem.findMany({
    where: {
      deletadoEm: null,
      status: { in: ["INICIADA", "RETORNANDO"] },
    },
    orderBy: { inicioPrevisto: "asc" },
    include: {
      entregas: true,
      motorista: true,
    },
  });
}