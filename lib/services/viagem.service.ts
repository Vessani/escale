import { prisma } from "@/lib/prisma";
import { NovaViagemInput, EditarViagemInput } from "@/lib/types/types";
import {
  calcularIntegracaoExigida,
  sugerirMotoristaAutomatico,
} from "./alocacao.service";

function resolverStatusPorAlocacao(motoristaId: number | null) {
  return motoristaId === null ? "CRIADA" : "ALOCADA";
}

export async function criarViagemService(dados: NovaViagemInput) {
  const integracaoNecessaria = calcularIntegracaoExigida(dados.entregas);
  const inicioPrevisto = new Date(dados.inicioPrevisto);

  const motoristas = await prisma.motorista.findMany({
    where: { deletadoEm: null },
    include: { integracao: true },
  });
  const motoristaSugerido = sugerirMotoristaAutomatico(motoristas, {
    turnoViagem: dados.turno,
    diasViagem: dados.diasViagem,
    dataInicioViagem: inicioPrevisto,
    integracaoExigida: integracaoNecessaria,
  });
  const motoristaEscolhidoId = motoristaSugerido?.id ?? null;

  return await prisma.viagem.create({
    data: {
      numViagem: dados.numViagem,
      carreta: dados.carreta,
      cavalo: dados.cavalo,
      tanque: dados.tanque,
      diasViagem: dados.diasViagem,
      inicioPrevisto,
      fimPrevisto: new Date(dados.fimPrevisto),
      turno: dados.turno,
      integracaoExigida: integracaoNecessaria,
      status: resolverStatusPorAlocacao(motoristaEscolhidoId),
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
      status:
        dados.motoristaId !== undefined
          ? resolverStatusPorAlocacao(dados.motoristaId ?? null)
          : undefined,
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