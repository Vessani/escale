import { prisma } from "@/lib/prisma";
import { NovoMotoristaInput, EditarMotoristaInput } from "@/lib/types/types";

export async function criarMotoristaService(dados: NovoMotoristaInput) {
  return await prisma.motorista.create({
    data: {
      nome: dados.nome,
      seva: dados.seva,
      diasTrabalhados: dados.diasTrabalhados,
      turno: dados.turno, // <--- Novo campo aqui!
      integracao: {
        create: dados.integracao.map((integ) => ({
          dataValidade: new Date(integ.dataValidade),
          cliente: integ.cliente,
          status: integ.status,
        })),
      },
    },
    include: {
      integracao: true,
    },
  });
}

export async function editarMotoristaService(idMotorista: number, dados: EditarMotoristaInput) {
  const integracaoExistentes = dados.integracao.filter(i => i.id);
  const integracaoNovas = dados.integracao.filter(i => !i.id);
  const manterIntegracao = integracaoExistentes.map(i => i.id as number);

  return await prisma.motorista.update({
    where: { id: idMotorista },
    data: { 
      nome: dados.nome,
      seva: dados.seva,
      diasTrabalhados: dados.diasTrabalhados,
      turno: dados.turno,
      integracao: {
        deleteMany: {
          id: { notIn: manterIntegracao }
        },
        update: integracaoExistentes.map((integracao) => ({
          where: { id: integracao.id },
          data: {
            dataValidade: new Date(integracao.dataValidade),
            cliente: integracao.cliente,
            status: integracao.status,
          }
        })),  
        create: integracaoNovas.map((integracao) => ({
          dataValidade: new Date(integracao.dataValidade),
          cliente: integracao.cliente,
          status: integracao.status,
        }))
      }
    }
  });
}

export async function deletarMotoristaService(id: number) {
  return await prisma.motorista.update({
    where: { id: id },
    data: {
      deletadoEm: new Date(),
    }
  });
}