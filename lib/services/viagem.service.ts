import { prisma } from "@/lib/prisma";
import { NovaViagemInput, EditarViagemInput } from "@/lib/types/types";
import { buscarMotoristasParaSelect } from "@/lib/queries/motoristas";
import {
  calcularIntegracaoExigida,
  sugerirMotoristaAutomatico,
} from "./alocacao.service";
import { reconciliarFolgaMotoristasNoDiaAtual } from "./folga.service";
import { converterEditarViagemParaBD, converterNovaViagemParaBD } from "./viagem-data-converter.service";
import { mapearRegistrosJornada } from "./jornada.service";
import { inicioDoDia } from "@/lib/utils/date-format";

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

    await reconciliarFolgaMotoristasNoDiaAtual(tx, [viagemCriada.motoristaId])

    return viagemCriada
  })
}

export async function criarViagemAvulsaService(dadosRecebidos: NovaViagemInput) {
  const dados = converterNovaViagemParaBD(dadosRecebidos);
  const integracaoNecessaria = calcularIntegracaoExigida(dados.entregas);
  const inicioPrevisto = dados.inicioPrevisto as Date;
  const fimPrevisto = dados.fimPrevisto as Date;

  const motoristasBrutos = await buscarMotoristasParaSelect();
  const motoristas = motoristasBrutos.map((motorista) => ({
    ...motorista,
    registrosJornada: mapearRegistrosJornada(motorista.registrosJornada),
  }));
  const hoje = inicioDoDia(new Date());

  const motoristaSugeridoDisponivel = sugerirMotoristaAutomatico(motoristas, fimPrevisto, {
    turnoViagem: dados.turno,
    diasViagem: dados.diasViagem,
    dataInicioViagem: inicioPrevisto,
    integracaoExigida: integracaoNecessaria,
    hoje,
  });
  const motoristaEscolhidoId = motoristaSugeridoDisponivel?.id ?? null;

  return inserirViagem(dados, integracaoNecessaria, motoristaEscolhidoId, dados.status);
}

/**
 * Cria a viagem já com o motorista escolhido (ou null, se nenhum foi
 * selecionado) — não roda sugestão automática de novo. Usado na importação em
 * lote, depois que o usuário já revisou e confirmou a alocação sugerida para
 * cada viagem do arquivo.
 */
export async function criarViagemComAlocacaoService(dadosRecebidos: NovaViagemInput, motoristaId: number | null) {
  const dados = converterNovaViagemParaBD(dadosRecebidos);
  const integracaoNecessaria = calcularIntegracaoExigida(dados.entregas);

  return inserirViagem(dados, integracaoNecessaria, motoristaId, dados.status);
}


export async function editarViagemService(idViagem: number, dadosRecebidos: EditarViagemInput) {
  const dados = converterEditarViagemParaBD(dadosRecebidos);
  const integracaoNecessaria = calcularIntegracaoExigida(dados.entregas);

  const entregasExistentes = dados.entregas.filter(e => e.id);
  const entregasNovas = dados.entregas.filter(e => !e.id);
  const manterEntregas = entregasExistentes.map(e => e.id as number);
  const viagemAtual = await prisma.viagem.findUnique({
    where: { id: idViagem },
    select: { status: true, motoristaId: true },
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

    await reconciliarFolgaMotoristasNoDiaAtual(tx, [viagemAtual.motoristaId, viagemAtualizada.motoristaId])
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

    await reconciliarFolgaMotoristasNoDiaAtual(tx, [viagemDeletada.motoristaId])
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

    await reconciliarFolgaMotoristasNoDiaAtual(tx, [viagemAtualizada.motoristaId])
    return viagemAtualizada
  })
}

/** Registro operacional feito pelo dashboard: horário real de saída e motivo do atraso, se houver. */
export async function atualizarSaidaRealService(
  idViagem: number,
  horarioRealSaida: Date | null,
  motivoAtraso: string | null,
) {
  return await prisma.viagem.update({
    where: { id: idViagem },
    data: { horarioRealSaida, motivoAtraso },
  })
}