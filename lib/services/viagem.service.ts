import { prisma } from "@/lib/prisma";
import { NovaViagemInput, EditarViagemInput } from "@/lib/types/types";
import { buscarMotoristasParaSelect } from "@/lib/queries/motoristas";
import { buscarNomesClientesQueExigemIntegracao } from "@/lib/queries/clientes";
import {
  calcularAvisoInterjornada,
  calcularIntegracaoExigida,
  motoristaAutorizadoParaProduto,
  sugerirMotoristaAutomatico,
} from "./alocacao.service";
import type { TipoProduto } from "@prisma/client";
import { reconciliarFolgaMotoristasNoDiaAtual } from "./folga.service";
import { registrarAuditoria, type Ator } from "./auditoria.service";
import { MotoristaProdutoNaoAutorizadoError, ViagemNaoEncontradaError, StatusViagemObrigatorioError, NumViagemDuplicadaError } from "@/lib/errors";
import { calcularAvisoFrotaIndisponivel, calcularAvisoFrotaProduto, sincronizarDisponibilidadeFrota } from "./frota.service";
import { converterEditarViagemParaBD, converterNovaViagemParaBD } from "./viagem-data-converter.service";
import { buscarFimJornadaAnterior } from "./motorista.service";
import { encontrarFimJornadaAnterior, mapearRegistrosJornada } from "./jornada.service";
import { calcularDiasEntre, inicioDoDia } from "@/lib/utils/date-format";

function resolverStatusPorAlocacao(motoristaId: number | null) {
  return motoristaId === null ? "CRIADA" : "ALOCADA";
}

function statusPermiteAutoAjuste(statusAtual: string) {
  return statusAtual === "CRIADA" || statusAtual === "ALOCADA"
}

/** Marca o instante da transição para CANCELADA — usado pelo Dashboard pra decidir até quando a viagem cancelada ainda aparece. Não mexe se o status não mudou (evita renovar a janela de visibilidade a cada edição de uma viagem já cancelada). */
function calcularCanceladoEm(statusNovo: string, statusAntigo: string): Date | undefined {
  return statusNovo === "CANCELADA" && statusAntigo !== "CANCELADA" ? new Date() : undefined
}

/**
 * Sem @unique em numViagem no schema (ver comentário no model Viagem) — a
 * unicidade só vale entre viagens ativas da mesma filial, então o app precisa
 * checar isso à mão antes de gravar (mesmo padrão de
 * criarFrotaService/editarFrotaService).
 */
async function garantirNumViagemDisponivel(filialId: number, numViagem: string, idExcluido?: number) {
  const existente = await prisma.viagem.findFirst({
    where: {
      numViagem,
      filialId,
      deletadoEm: null,
      ...(idExcluido !== undefined ? { id: { not: idExcluido } } : {}),
    },
    select: { id: true },
  })

  if (existente) {
    throw new NumViagemDuplicadaError()
  }
}

/**
 * Bloqueio rígido: garante que o motorista informado (se houver) está
 * autorizado a carregar o produto exigido pela viagem — mesma regra que já
 * filtra a sugestão automática/tela de alocação (ver motoristaEhCompativel),
 * mas reaplicada aqui no momento de *gravar* a alocação (criar, editar,
 * alocação rápida do dashboard). Sem isso era possível contornar o
 * bloqueio: a tela de sugestão nunca oferece um motorista incompatível, mas
 * nada impedia editar a viagem (ou trocar só o produto) mantendo um
 * motorista que já estava alocado antes da troca.
 */
async function garantirMotoristaAutorizadoParaProduto(
  motoristaId: number | null | undefined,
  produtoExigido: TipoProduto | null | undefined,
) {
  if (!motoristaId || !produtoExigido) {
    return
  }

  const motorista = await prisma.motorista.findUnique({
    where: { id: motoristaId },
    select: { produtosAutorizados: true },
  })

  if (motorista && !motoristaAutorizadoParaProduto(motorista.produtosAutorizados, produtoExigido)) {
    throw new MotoristaProdutoNaoAutorizadoError()
  }
}

type DadosViagemConvertidos = ReturnType<typeof converterNovaViagemParaBD>

/** Busca o fim da jornada real anterior à viagem e calcula o aviso — usado quando só se tem o id do motorista, não o objeto completo com o histórico já carregado (ver buscarFimJornadaAnterior). */
async function calcularAvisoInterjornadaPorId(filialId: number, motoristaId: number | null, inicioPrevisto: Date) {
  if (motoristaId === null) {
    return null
  }

  const fimJornadaAnterior = await buscarFimJornadaAnterior(filialId, motoristaId, inicioPrevisto)
  return calcularAvisoInterjornada(fimJornadaAnterior, inicioPrevisto)
}

async function inserirViagem(
  filialId: number,
  dados: DadosViagemConvertidos,
  integracaoNecessaria: string | null,
  motoristaId: number | null,
  status: NovaViagemInput["status"],
  avisoInterjornada: string | null,
  ator: Ator | null,
) {
  await garantirNumViagemDisponivel(filialId, dados.numViagem)
  await garantirMotoristaAutorizadoParaProduto(motoristaId, dados.produto)

  const avisoFrotaIndisponivel = await calcularAvisoFrotaIndisponivel(
    filialId,
    dados.cavalo,
    dados.carreta,
    dados.inicioPrevisto as Date,
  )
  const avisoFrotaProdutoIncompativel = await calcularAvisoFrotaProduto(filialId, dados.cavalo, dados.carreta, dados.produto)

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
        produto: dados.produto,
        integracaoExigida: integracaoNecessaria,
        status: status ?? resolverStatusPorAlocacao(motoristaId),
        viagemExtra: dados.viagemExtra ?? false,
        motoristaId,
        avisoInterjornada,
        avisoFrotaIndisponivel,
        avisoFrotaProdutoIncompativel,
        filialId,
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

    await sincronizarDisponibilidadeFrota(tx, filialId, dados.cavalo, dados.carreta)
    await reconciliarFolgaMotoristasNoDiaAtual(tx, [viagemCriada.motoristaId], [
      { inicioPrevisto: viagemCriada.inicioPrevisto, fimPrevisto: viagemCriada.fimPrevisto },
    ])
    await registrarAuditoria(tx, {
      entidade: "Viagem",
      entidadeId: viagemCriada.id,
      acao: "CRIACAO",
      depois: viagemCriada,
      ator,
      filialId,
    })

    return viagemCriada
  })
}

export async function criarViagemAvulsaService(filialId: number, dadosRecebidos: NovaViagemInput, ator: Ator | null) {
  const dados = converterNovaViagemParaBD(dadosRecebidos);
  const clientesQueExigemIntegracao = await buscarNomesClientesQueExigemIntegracao();
  const integracaoNecessaria = calcularIntegracaoExigida(dados.entregas, clientesQueExigemIntegracao);
  const inicioPrevisto = dados.inicioPrevisto as Date;
  const fimPrevisto = dados.fimPrevisto as Date;

  const motoristasBrutos = await buscarMotoristasParaSelect(filialId);
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
    produtoExigido: dados.produto,
    hoje,
  });
  const motoristaEscolhidoId = motoristaSugeridoDisponivel?.id ?? null;
  // motoristaSugeridoDisponivel já vem com o histórico de jornada carregado
  // (ver `motoristas` acima) — encontra o fim real anterior em memória, sem
  // precisar de outra consulta (ver encontrarFimJornadaAnterior).
  const fimJornadaAnterior = motoristaSugeridoDisponivel
    ? encontrarFimJornadaAnterior(motoristaSugeridoDisponivel.registrosJornada, inicioPrevisto)
    : null;
  const avisoInterjornada = calcularAvisoInterjornada(fimJornadaAnterior, inicioPrevisto);

  return inserirViagem(filialId, dados, integracaoNecessaria, motoristaEscolhidoId, dados.status, avisoInterjornada, ator);
}

/**
 * Cria a viagem já com o motorista escolhido (ou null, se nenhum foi
 * selecionado) — não roda sugestão automática de novo. Usado na importação em
 * lote, depois que o usuário já revisou e confirmou a alocação sugerida para
 * cada viagem do arquivo.
 */
export async function criarViagemComAlocacaoService(filialId: number, dadosRecebidos: NovaViagemInput, motoristaId: number | null, ator: Ator | null) {
  const dados = converterNovaViagemParaBD(dadosRecebidos);
  const clientesQueExigemIntegracao = await buscarNomesClientesQueExigemIntegracao();
  const integracaoNecessaria = calcularIntegracaoExigida(dados.entregas, clientesQueExigemIntegracao);
  const avisoInterjornada = await calcularAvisoInterjornadaPorId(filialId, motoristaId, dados.inicioPrevisto as Date);

  return inserirViagem(filialId, dados, integracaoNecessaria, motoristaId, dados.status, avisoInterjornada, ator);
}


export async function editarViagemService(filialId: number, idViagem: number, dadosRecebidos: EditarViagemInput, ator: Ator | null) {
  const dados = converterEditarViagemParaBD(dadosRecebidos);
  const clientesQueExigemIntegracao = await buscarNomesClientesQueExigemIntegracao();
  const integracaoNecessaria = calcularIntegracaoExigida(dados.entregas, clientesQueExigemIntegracao);

  const entregasExistentes = dados.entregas.filter(e => e.id);
  const entregasNovas = dados.entregas.filter(e => !e.id);
  const manterEntregas = entregasExistentes.map(e => e.id as number);
  // Linha completa (não um select estreito) — vira o snapshot "antes" da
  // auditoria, além de alimentar a lógica de negócio abaixo.
  const viagemAtual = await prisma.viagem.findUnique({
    where: { id: idViagem, filialId },
  })

  if (!viagemAtual) {
    throw new ViagemNaoEncontradaError()
  }

  await garantirNumViagemDisponivel(filialId, dados.numViagem, idViagem)

  const statusDerivado =
    dados.motoristaId !== undefined
      ? resolverStatusPorAlocacao(dados.motoristaId ?? null)
      : undefined
  const statusFinal =
    dados.status ??
    (statusDerivado && statusPermiteAutoAjuste(viagemAtual.status)
      ? statusDerivado
      : viagemAtual.status)

  const motoristaIdFinal = dados.motoristaId !== undefined ? dados.motoristaId : viagemAtual.motoristaId
  await garantirMotoristaAutorizadoParaProduto(motoristaIdFinal, dados.produto)
  const avisoInterjornada = await calcularAvisoInterjornadaPorId(filialId, motoristaIdFinal, dados.inicioPrevisto as Date)
  const avisoFrotaIndisponivel = await calcularAvisoFrotaIndisponivel(
    filialId,
    dados.cavalo,
    dados.carreta,
    dados.inicioPrevisto as Date,
  )
  const avisoFrotaProdutoIncompativel = await calcularAvisoFrotaProduto(filialId, dados.cavalo, dados.carreta, dados.produto)

  return await prisma.$transaction(async (tx) => {
    const viagemAtualizada = await tx.viagem.update({
      where: { id: idViagem, filialId },
      data: {
        numViagem: dados.numViagem,
        carreta: dados.carreta,
        cavalo: dados.cavalo,
        tanque: dados.tanque,
        diasViagem: dados.diasViagem,
        inicioPrevisto: dados.inicioPrevisto as Date,
        fimPrevisto: dados.fimPrevisto as Date,
        turno: dados.turno,
        produto: dados.produto,
        integracaoExigida: integracaoNecessaria,
        status: statusFinal,
        viagemExtra: dados.viagemExtra !== undefined ? dados.viagemExtra : undefined,
        canceladoEm: calcularCanceladoEm(statusFinal, viagemAtual.status),
        motoristaId: dados.motoristaId !== undefined ? dados.motoristaId : undefined,
        motoristaAcompanhanteId: dados.motoristaAcompanhanteId !== undefined ? dados.motoristaAcompanhanteId : undefined,
        avisoInterjornada,
        avisoFrotaIndisponivel,
        avisoFrotaProdutoIncompativel,
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

    await sincronizarDisponibilidadeFrota(tx, filialId, dados.cavalo, dados.carreta)
    // Trocou de cavalo/carreta na edição: a dupla antiga também precisa
    // recalcular, senão fica "presa" no fim previsto desta viagem mesmo
    // depois dela ter saído de lá.
    if (dados.cavalo !== viagemAtual.cavalo || dados.carreta !== viagemAtual.carreta) {
      await sincronizarDisponibilidadeFrota(tx, filialId, viagemAtual.cavalo, viagemAtual.carreta)
    }
    await reconciliarFolgaMotoristasNoDiaAtual(
      tx,
      [
        viagemAtual.motoristaId,
        viagemAtualizada.motoristaId,
        viagemAtual.motoristaAcompanhanteId,
        viagemAtualizada.motoristaAcompanhanteId,
      ],
      [
        { inicioPrevisto: viagemAtual.inicioPrevisto, fimPrevisto: viagemAtual.fimPrevisto },
        { inicioPrevisto: viagemAtualizada.inicioPrevisto, fimPrevisto: viagemAtualizada.fimPrevisto },
      ],
    )
    await registrarAuditoria(tx, {
      entidade: "Viagem",
      entidadeId: idViagem,
      acao: "ATUALIZACAO",
      antes: viagemAtual,
      depois: viagemAtualizada,
      ator,
      filialId,
    })
    return viagemAtualizada
  })
}

export async function deletarViagemService(filialId: number, id: number, ator: Ator | null) {
  const viagemAntes = await prisma.viagem.findUniqueOrThrow({ where: { id, filialId } })

  return await prisma.$transaction(async (tx) => {
    const viagemDeletada = await tx.viagem.update({
      where: { id: id, filialId },
      data: {
        deletadoEm: new Date(),
      }
    })

    await sincronizarDisponibilidadeFrota(tx, filialId, viagemDeletada.cavalo, viagemDeletada.carreta)
    await reconciliarFolgaMotoristasNoDiaAtual(
      tx,
      [viagemDeletada.motoristaId, viagemDeletada.motoristaAcompanhanteId],
      [{ inicioPrevisto: viagemDeletada.inicioPrevisto, fimPrevisto: viagemDeletada.fimPrevisto }],
    )
    await registrarAuditoria(tx, {
      entidade: "Viagem",
      entidadeId: id,
      acao: "EXCLUSAO",
      antes: viagemAntes,
      depois: viagemDeletada,
      ator,
      filialId,
    })
    return viagemDeletada
  })
}

/** Nova data de início/fim exigida só quando o status vai para POSTERGADA — ver atualizarStatusViagemService. */
export type NovaDataViagem = { inicioPrevisto: Date; fimPrevisto: Date }

export async function atualizarStatusViagemService(
  filialId: number,
  idViagem: number,
  status: EditarViagemInput["status"],
  ator: Ator | null,
  novaData?: NovaDataViagem,
) {
  if (!status) {
    throw new StatusViagemObrigatorioError()
  }

  // Linha completa — vira o snapshot "antes" da auditoria.
  const viagemAtual = await prisma.viagem.findUnique({
    where: { id: idViagem, filialId },
  })

  if (!viagemAtual) {
    throw new ViagemNaoEncontradaError()
  }

  // Postergar muda a data — os avisos de interjornada/frota gravados na
  // criação/última edição são recalculados pra essa data nova, senão ficam
  // "presos" no valor de quando a viagem foi criada/editada pela última vez
  // (ex: aviso de frota indisponível que não valia mais pro horário novo).
  const avisosRecalculados = novaData
    ? {
        avisoInterjornada: await calcularAvisoInterjornadaPorId(filialId, viagemAtual.motoristaId, novaData.inicioPrevisto),
        avisoFrotaIndisponivel: await calcularAvisoFrotaIndisponivel(filialId, viagemAtual.cavalo, viagemAtual.carreta, novaData.inicioPrevisto),
        avisoFrotaProdutoIncompativel: await calcularAvisoFrotaProduto(filialId, viagemAtual.cavalo, viagemAtual.carreta, viagemAtual.produto),
      }
    : {}

  return await prisma.$transaction(async (tx) => {
    const viagemAtualizada = await tx.viagem.update({
      where: { id: idViagem, filialId },
      data: {
        status,
        canceladoEm: calcularCanceladoEm(status, viagemAtual.status),
        ...(novaData ? {
          inicioPrevisto: novaData.inicioPrevisto,
          fimPrevisto: novaData.fimPrevisto,
          diasViagem: calcularDiasEntre(novaData.inicioPrevisto, novaData.fimPrevisto),
        } : {}),
        ...avisosRecalculados,
      },
    })

    // Cancelar/finalizar (ou postergar a data) muda se essa viagem ainda
    // "segura" a frota — sincroniza sempre, não só quando novaData é enviado.
    await sincronizarDisponibilidadeFrota(tx, filialId, viagemAtualizada.cavalo, viagemAtualizada.carreta)
    await reconciliarFolgaMotoristasNoDiaAtual(
      tx,
      [viagemAtualizada.motoristaId, viagemAtualizada.motoristaAcompanhanteId],
      [
        { inicioPrevisto: viagemAtual.inicioPrevisto, fimPrevisto: viagemAtual.fimPrevisto },
        { inicioPrevisto: viagemAtualizada.inicioPrevisto, fimPrevisto: viagemAtualizada.fimPrevisto },
      ],
    )
    await registrarAuditoria(tx, {
      entidade: "Viagem",
      entidadeId: idViagem,
      acao: "ATUALIZACAO",
      antes: viagemAtual,
      depois: viagemAtualizada,
      ator,
      filialId,
    })
    return viagemAtualizada
  })
}

/**
 * Alocação rápida feita direto pelo Dashboard: grava só motorista principal e
 * acompanhante (e ajusta o status por alocação, como editarViagemService já
 * faz) — sem mexer em entregas, frota ou datas, que continuam exclusivas da
 * tela de edição completa.
 */
export async function atualizarAlocacaoViagemService(
  filialId: number,
  idViagem: number,
  dados: { motoristaId: number | null; motoristaAcompanhanteId: number | null },
  ator: Ator | null,
) {
  // Linha completa — vira o snapshot "antes" da auditoria.
  const viagemAtual = await prisma.viagem.findUnique({
    where: { id: idViagem, filialId },
  })

  if (!viagemAtual) {
    throw new ViagemNaoEncontradaError()
  }

  await garantirMotoristaAutorizadoParaProduto(dados.motoristaId, viagemAtual.produto)

  const statusFinal = statusPermiteAutoAjuste(viagemAtual.status)
    ? resolverStatusPorAlocacao(dados.motoristaId)
    : viagemAtual.status
  const avisoInterjornada = await calcularAvisoInterjornadaPorId(filialId, dados.motoristaId, viagemAtual.inicioPrevisto)

  return await prisma.$transaction(async (tx) => {
    const viagemAtualizada = await tx.viagem.update({
      where: { id: idViagem, filialId },
      data: {
        motoristaId: dados.motoristaId,
        motoristaAcompanhanteId: dados.motoristaAcompanhanteId,
        status: statusFinal,
        avisoInterjornada,
      },
    })

    await reconciliarFolgaMotoristasNoDiaAtual(
      tx,
      [
        viagemAtual.motoristaId,
        viagemAtualizada.motoristaId,
        viagemAtual.motoristaAcompanhanteId,
        viagemAtualizada.motoristaAcompanhanteId,
      ],
      [{ inicioPrevisto: viagemAtual.inicioPrevisto, fimPrevisto: viagemAtual.fimPrevisto }],
    )
    await registrarAuditoria(tx, {
      entidade: "Viagem",
      entidadeId: idViagem,
      acao: "ATUALIZACAO",
      antes: viagemAtual,
      depois: viagemAtualizada,
      ator,
      filialId,
    })

    return viagemAtualizada
  })
}

/** Registro operacional feito pelo dashboard: horário real de saída e motivo do atraso, se houver. */
export async function atualizarSaidaRealService(
  filialId: number,
  idViagem: number,
  horarioRealSaida: Date | null,
  motivoAtraso: string | null,
  ator: Ator | null,
) {
  const viagemAntes = await prisma.viagem.findUniqueOrThrow({ where: { id: idViagem, filialId } })

  return await prisma.$transaction(async (tx) => {
    const viagemDepois = await tx.viagem.update({
      where: { id: idViagem, filialId },
      data: { horarioRealSaida, motivoAtraso },
    })
    await registrarAuditoria(tx, {
      entidade: "Viagem",
      entidadeId: idViagem,
      acao: "ATUALIZACAO",
      antes: viagemAntes,
      depois: viagemDepois,
      ator,
      filialId,
    })
    return viagemDepois
  })
}