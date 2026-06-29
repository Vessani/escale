import { prisma } from "@/lib/prisma";
import { NovaViagemInput, EditarViagemInput, NovaEntregaInput } from "@/lib/types/types";


const REGRAS_INTEGRACAO: Record<string, string> = {
  "AMBEV": "AMBEV",
  "WEG": "WEG",  
};

function calcularIntegracaoExigida(entregas: NovaEntregaInput[]): string | null {
  for (const entrega of entregas) {
    const chave = `${entrega.cliente}-${entrega.cidade}`.toUpperCase();
    if (REGRAS_INTEGRACAO[chave]) {
      return REGRAS_INTEGRACAO[chave];
    }
  }
  return null;
}

export async function criarViagemService(dados: NovaViagemInput) {
 
  const integracaoNecessaria = calcularIntegracaoExigida(dados.entregas);
  
  const motoristaCompativel = await prisma.motorista.findFirst({
    where: {
      deletadoEm: null,
      turno: dados.turno,
      ...(integracaoNecessaria ? {
        integracao: {
          some: {
            cliente: integracaoNecessaria,
            status: 'ATIVO',
            dataValidade: {
              gte: new Date(dados.inicioPrevisto)
            }
          }
        }
      } : {})
    },
    orderBy: {
      diasTrabalhados: 'asc' 
    }
  });
  let motoristaEscolhidoId = null;

  if (motoristaCompativel) {
    motoristaEscolhidoId = motoristaCompativel.id;
  }
    

  return await prisma.viagem.create({
    data: {
      numViagem: dados.numViagem,
      carreta: dados.carreta,
      cavalo: dados.cavalo,
      tanque: dados.tanque,
      diasViagem: dados.diasViagem,
      inicioPrevisto: new Date(dados.inicioPrevisto),
      fimPrevisto: new Date(dados.fimPrevisto),
      turno: dados.turno,
      integracaoExigida: integracaoNecessaria,
  
      motoristaId: motoristaEscolhidoId, 
      
      entregas: {
        create: dados.entregas.map((entrega) => ({
          dataEntrega: new Date(entrega.dataEntrega),
          cliente: entrega.cliente,
          cidade: entrega.cidade,
          uf: entrega.uf,
          kg: entrega.kg,
          m3: entrega.m3,
          obs: entrega.obs,
          sapcode: entrega.sapcode,
          codewhite: entrega.codewhite,
        })),
      },
    },
    include: {
      entregas: true,
      motorista: true,
    },
  });
}


export async function editarViagemService(idViagem: number, dados: EditarViagemInput) {
  const integracaoNecessaria = calcularIntegracaoExigida(dados.entregas);

  const entregasExistentes = dados.entregas.filter(e => e.id);
  const entregasNovas = dados.entregas.filter(e => !e.id);
  const manterEntregas = entregasExistentes.map(e => e.id as number);

  return await prisma.viagem.update({
    where: { id: idViagem },
    data: {
      numViagem: dados.numViagem,
      carreta: dados.carreta,
      cavalo: dados.cavalo,
      tanque: dados.tanque,
      diasViagem: dados.diasViagem,
      
      inicioPrevisto: new Date(dados.inicioPrevisto),
      fimPrevisto: new Date(dados.fimPrevisto),
      turno: dados.turno,
      
      integracaoExigida: integracaoNecessaria,
      
      motoristaId: dados.motoristaId !== undefined ? dados.motoristaId : undefined,
      
      entregas: {
        deleteMany: {
          id: { notIn: manterEntregas }
        },
        update: entregasExistentes.map((entrega) => ({
          where: { id: entrega.id },
          data: {
            dataEntrega: new Date(entrega.dataEntrega),
            cliente: entrega.cliente,
            cidade: entrega.cidade,
            uf: entrega.uf,
            kg: entrega.kg,
            m3: entrega.m3,
            obs: entrega.obs,
            sapcode: entrega.sapcode,
            codewhite: entrega.codewhite,
          }
        })),
        create: entregasNovas.map((entrega) => ({
          dataEntrega: new Date(entrega.dataEntrega),
          cliente: entrega.cliente,
          cidade: entrega.cidade,
          uf: entrega.uf,
          kg: entrega.kg,
          m3: entrega.m3,
          obs: entrega.obs,
          sapcode: entrega.sapcode,
          codewhite: entrega.codewhite,
        }))
      }
    }
  });
}

export async function deletarViagemService(id: number) {
  return await prisma.viagem.update({
    where: { id: id },
    data: {
      deletadoEm: new Date(),
    }
  });
}