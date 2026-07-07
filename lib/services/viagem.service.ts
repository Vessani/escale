import { prisma } from "@/lib/prisma";
import { NovaViagemInput, EditarViagemInput } from "@/lib/types/types";
import {
  calcularIntegracaoExigida,
  filtrarMotoristasDisponiveisNoPeriodo,
  sugerirMotoristaAutomatico,
} from "./alocacao.service";
import { reconciliarFolgaMotoristasNoDiaAtual } from "./folga.service";
import { converterEditarViagemParaBD, converterNovaViagemParaBD } from "./viagem-data-converter.service";

function resolverStatusPorAlocacao(motoristaId: number | null) {
  return motoristaId === null ? "CRIADA" : "ALOCADA";
}

function statusPermiteAutoAjuste(statusAtual: string) {
  return statusAtual === "CRIADA" || statusAtual === "ALOCADA"
}

type DadosViagemConvertidos = ReturnType<typeof converterNovaViagemParaBD>

function inserirViagem(
  dados: DadosViagemConvertidos,
  integracaoNecessaria: string | null,
  motoristaId: number | null,
  status: NovaViagemInput["status"],
) {
  return prisma.$transaction(async (tx) => {
    const viagemCriada = await tx.viagem.create({
      data: {
        numViagem: dados.numViagem,
        carreta: dados.carreta,
        cavalo: dados.cavalo,
        tanque: dados.tanque,
        diasViagem: dados.diasViagem,
        inicioPrevisto: dados.inicioPrevisto as Date,
        fimPrevisto: dados.fimPrevisto as Date,
        turno: dados.turno,
        integracaoExigida: integracaoNecessaria,
        status: status ?? resolverStatusPorAlocacao(motoristaId),
        motoristaId,
        entregas: {
          create: dados.entregas.map((entrega) => ({
            dataEntrega: entrega.dataEntrega as Date,
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
    })

    await reconciliarFolgaMotoristasNoDiaAtual(tx)

    return viagemCriada
  })
}

export async function criarViagemService(dadosRecebidos: NovaViagemInput) {
  const dados = converterNovaViagemParaBD(dadosRecebidos);
  const integracaoNecessaria = calcularIntegracaoExigida(dados.entregas);
  const inicioPrevisto = dados.inicioPrevisto as Date;
  const fimPrevisto = dados.fimPrevisto as Date;

  const motoristas = await prisma.motorista.findMany({
    where: { deletadoEm: null },
    include: {
      integracao: true,
      viagens: {
        where: {
          deletadoEm: null,
          status: { notIn: ["CANCELADA", "FINALIZADA"] },
          inicioPrevisto: { lt: fimPrevisto },
          fimPrevisto: { gt: inicioPrevisto },
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
  const motoristasDisponiveis = filtrarMotoristasDisponiveisNoPeriodo(
    motoristas,
    inicioPrevisto,
    fimPrevisto,
  );
  const motoristaSugeridoDisponivel = sugerirMotoristaAutomatico(motoristasDisponiveis, {
    turnoViagem: dados.turno,
    diasViagem: dados.diasViagem,
    dataInicioViagem: inicioPrevisto,
    integracaoExigida: integracaoNecessaria,
  });
  const motoristaEscolhidoId = motoristaSugeridoDisponivel?.id ?? null;

  return inserirViagem(dados, integracaoNecessaria, motoristaEscolhidoId, dados.status);
}

/**
 * Cria a viagem sem sugerir/atribuir motorista automaticamente.
 * Usado na importação em lote: a decisão de motorista fica inteiramente
 * a cargo da tela de alocação, onde dá pra comparar sugestões entre viagens.
 */
export async function criarViagemSemAlocacaoService(dadosRecebidos: NovaViagemInput) {
  const dados = converterNovaViagemParaBD(dadosRecebidos);
  const integracaoNecessaria = calcularIntegracaoExigida(dados.entregas);

  return inserirViagem(dados, integracaoNecessaria, null, "CRIADA");
}


export async function editarViagemService(idViagem: number, dadosRecebidos: EditarViagemInput) {
  const dados = converterEditarViagemParaBD(dadosRecebidos);
  const integracaoNecessaria = calcularIntegracaoExigida(dados.entregas);

  const entregasExistentes = dados.entregas.filter(e => e.id);
  const entregasNovas = dados.entregas.filter(e => !e.id);
  const manterEntregas = entregasExistentes.map(e => e.id as number);
  const viagemAtual = await prisma.viagem.findUnique({
    where: { id: idViagem },
    select: { status: true },
  })

  if (!viagemAtual) {
    throw new Error("Viagem não encontrada.")
  }

  const statusDerivado =
    dados.motoristaId !== undefined
      ? resolverStatusPorAlocacao(dados.motoristaId ?? null)
      : undefined
  const statusFinal =
    dados.status ??
    (statusDerivado && statusPermiteAutoAjuste(viagemAtual.status)
      ? statusDerivado
      : viagemAtual.status)

  return await prisma.$transaction(async (tx) => {
    const viagemAtualizada = await tx.viagem.update({
      where: { id: idViagem },
      data: {
        numViagem: dados.numViagem,
        carreta: dados.carreta,
        cavalo: dados.cavalo,
        tanque: dados.tanque,
        diasViagem: dados.diasViagem,
        inicioPrevisto: dados.inicioPrevisto as Date,
        fimPrevisto: dados.fimPrevisto as Date,
        turno: dados.turno,
        integracaoExigida: integracaoNecessaria,
        status: statusFinal,
        motoristaId: dados.motoristaId !== undefined ? dados.motoristaId : undefined,
        entregas: {
          deleteMany: {
            id: { notIn: manterEntregas }
          },
          update: entregasExistentes.map((entrega) => ({
            where: { id: entrega.id },
            data: {
              dataEntrega: entrega.dataEntrega as Date,
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
            dataEntrega: entrega.dataEntrega as Date,
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
    })

    await reconciliarFolgaMotoristasNoDiaAtual(tx)
    return viagemAtualizada
  })
}

export async function deletarViagemService(id: number) {
  return await prisma.$transaction(async (tx) => {
    const viagemDeletada = await tx.viagem.update({
      where: { id: id },
      data: {
        deletadoEm: new Date(),
      }
    })

    await reconciliarFolgaMotoristasNoDiaAtual(tx)
    return viagemDeletada
  })
}

export async function atualizarStatusViagemService(idViagem: number, status: EditarViagemInput["status"]) {
  if (!status) {
    throw new Error("Status de viagem é obrigatório.")
  }

  return await prisma.$transaction(async (tx) => {
    const viagemAtualizada = await tx.viagem.update({
      where: { id: idViagem },
      data: { status },
    })

    await reconciliarFolgaMotoristasNoDiaAtual(tx)
    return viagemAtualizada
  })
}