import { prisma } from "@/lib/prisma";
import { NovaViagemInput, EditarViagemInput } from "@/lib/types/types";
import { buscarMotoristasParaSelect } from "@/lib/queries/motoristas";
import { buscarNumerosSapQueExigemIntegracao } from "@/lib/queries/clientes";
import {
  calcularIntegracaoExigida,
  motoristaAutorizadoParaProduto,
  sugerirMotoristaAutomatico,
} from "./alocacao.service";
import type { TipoProduto } from "@prisma/client";
import { reconciliarFolgaMotoristasNoDiaAtual } from "./folga.service";
import { registrarAuditoria, type Ator } from "./auditoria.service";
import { MotoristaProdutoNaoAutorizadoError, MotoristaNaoEncontradoError, MotoristaEmTreinamentoError, ViagemNaoEncontradaError, StatusViagemObrigatorioError, NumViagemDuplicadaError } from "@/lib/errors";
import { calcularAvisoFrotaIndisponivel, calcularAvisoFrotaProduto, sincronizarDisponibilidadeFrota } from "./frota.service";
import { converterEditarViagemParaBD, converterNovaViagemParaBD } from "./viagem-data-converter.service";
import { mapearRegistrosJornada } from "./jornada.service";
import { recalcularAvisosInterjornada } from "./interjornada.service";
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
 * Marca o instante da transição para FINALIZADA — a partir dele o motorista
 * está livre (o descanso de 11h/35h conta daqui, ver fimEfetivoViagem). Não
 * mexe se já estava finalizada; limpa se a viagem for reaberta, pra não
 * deixar uma finalização antiga valendo.
 */
function calcularFinalizadoEm(statusNovo: string, statusAntigo: string): Date | null | undefined {
  if (statusNovo === "FINALIZADA") {
    return statusAntigo !== "FINALIZADA" ? new Date() : undefined
  }
  return statusAntigo === "FINALIZADA" ? null : undefined
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
type MotoristasDaViagem = {
  principalId: number | null | undefined
  acompanhanteId?: number | null
  produtoExigido: TipoProduto | null | undefined
  /** Quem já estava na viagem antes desta gravação — ver comentário abaixo. */
  atuais?: { principalId: number | null; acompanhanteId: number | null }
}

/**
 * Revalida no servidor os motoristas que chegam do navegador ao gravar uma
 * viagem — a tela só oferece motoristas válidos, mas a Server Action pode
 * ser chamada direto, então o id em si não é confiável:
 * - tem que ser da filial da sessão e não estar excluído (senão dava pra
 *   alocar motorista de outra filial, ou um já removido);
 * - o principal não pode estar em treinamento (`liberado = false` — só como
 *   acompanhante, mesma regra de motoristaEhCompativel);
 * - o principal precisa estar autorizado pro produto da viagem (bloqueio
 *   rígido, mesmo nível de turno).
 *
 * Excluído/treinamento só são cobrados de quem está ENTRANDO na viagem
 * (diferente de `atuais`): editar uma viagem antiga cujo motorista foi
 * excluído ou voltou pra treinamento depois não pode travar a edição dela.
 * Filial e produto valem sempre.
 */
async function garantirMotoristasValidos(filialId: number, dados: MotoristasDaViagem) {
  const { principalId, acompanhanteId, produtoExigido, atuais } = dados

  if (principalId) {
    const principal = await buscarMotoristaDaFilial(filialId, principalId, principalId !== atuais?.principalId)

    if (principal.liberado === false && principalId !== atuais?.principalId) {
      throw new MotoristaEmTreinamentoError()
    }

    if (produtoExigido && !motoristaAutorizadoParaProduto(principal.produtosAutorizados, produtoExigido)) {
      throw new MotoristaProdutoNaoAutorizadoError()
    }
  }

  if (acompanhanteId) {
    await buscarMotoristaDaFilial(filialId, acompanhanteId, acompanhanteId !== atuais?.acompanhanteId)
  }
}

async function buscarMotoristaDaFilial(filialId: number, id: number, exigirAtivo: boolean) {
  const motorista = await prisma.motorista.findFirst({
    where: { id, filialId, ...(exigirAtivo ? { deletadoEm: null } : {}) },
    select: { produtosAutorizados: true, liberado: true },
  })

  if (!motorista) {
    throw new MotoristaNaoEncontradoError()
  }

  return motorista
}

type DadosViagemConvertidos = ReturnType<typeof converterNovaViagemParaBD>

// O aviso de interjornada/descanso não é mais calculado aqui, viagem a
// viagem: toda gravação chama recalcularAvisosInterjornada dentro da
// transação, que atualiza as viagens em aberto dos motoristas envolvidos
// (inclusive a próxima viagem de quem acabou de ser liberado).

async function inserirViagem(
  filialId: number,
  dados: DadosViagemConvertidos,
  integracaoNecessaria: string | null,
  motoristaId: number | null,
  status: NovaViagemInput["status"],
  ator: Ator | null,
) {
  await garantirNumViagemDisponivel(filialId, dados.numViagem)
  await garantirMotoristasValidos(filialId, { principalId: motoristaId, produtoExigido: dados.produto })

  const avisoFrotaIndisponivel = await calcularAvisoFrotaIndisponivel(
    filialId,
    dados.cavalo,
    dados.carreta,
    dados.inicioPrevisto as Date,
  )
  const avisoFrotaProdutoIncompativel = await calcularAvisoFrotaProduto(filialId, dados.cavalo, dados.carreta, dados.produto)

  const statusInicial = status ?? resolverStatusPorAlocacao(motoristaId)

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
        status: statusInicial,
        finalizadoEm: calcularFinalizadoEm(statusInicial, "CRIADA"),
        viagemExtra: dados.viagemExtra ?? false,
        motoristaId,
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
    await recalcularAvisosInterjornada(tx, filialId, [viagemCriada.motoristaId])
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
  const numerosSapQueExigemIntegracao = await buscarNumerosSapQueExigemIntegracao();
  const integracaoNecessaria = calcularIntegracaoExigida(dados.entregas, numerosSapQueExigemIntegracao);
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

  return inserirViagem(filialId, dados, integracaoNecessaria, motoristaEscolhidoId, dados.status, ator);
}

/**
 * Cria a viagem já com o motorista escolhido (ou null, se nenhum foi
 * selecionado) — não roda sugestão automática de novo. Usado na importação em
 * lote, depois que o usuário já revisou e confirmou a alocação sugerida para
 * cada viagem do arquivo.
 */
export async function criarViagemComAlocacaoService(filialId: number, dadosRecebidos: NovaViagemInput, motoristaId: number | null, ator: Ator | null) {
  const dados = converterNovaViagemParaBD(dadosRecebidos);
  const numerosSapQueExigemIntegracao = await buscarNumerosSapQueExigemIntegracao();
  const integracaoNecessaria = calcularIntegracaoExigida(dados.entregas, numerosSapQueExigemIntegracao);

  return inserirViagem(filialId, dados, integracaoNecessaria, motoristaId, dados.status, ator);
}


export async function editarViagemService(filialId: number, idViagem: number, dadosRecebidos: EditarViagemInput, ator: Ator | null) {
  const dados = converterEditarViagemParaBD(dadosRecebidos);
  const numerosSapQueExigemIntegracao = await buscarNumerosSapQueExigemIntegracao();
  const integracaoNecessaria = calcularIntegracaoExigida(dados.entregas, numerosSapQueExigemIntegracao);

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
  const acompanhanteIdFinal =
    dados.motoristaAcompanhanteId !== undefined ? dados.motoristaAcompanhanteId : viagemAtual.motoristaAcompanhanteId
  await garantirMotoristasValidos(filialId, {
    principalId: motoristaIdFinal,
    acompanhanteId: acompanhanteIdFinal,
    produtoExigido: dados.produto,
    atuais: { principalId: viagemAtual.motoristaId, acompanhanteId: viagemAtual.motoristaAcompanhanteId },
  })
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
        finalizadoEm: calcularFinalizadoEm(statusFinal, viagemAtual.status),
        motoristaId: dados.motoristaId !== undefined ? dados.motoristaId : undefined,
        motoristaAcompanhanteId: dados.motoristaAcompanhanteId !== undefined ? dados.motoristaAcompanhanteId : undefined,
        // Sem motorista não há descanso a avisar — o recálculo abaixo só
        // alcança viagens que têm motorista principal.
        ...(motoristaIdFinal === null ? { avisoInterjornada: null } : {}),
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
    // Trocou de carreta na edição: a carreta antiga também precisa
    // recalcular, senão fica "presa" no fim previsto desta viagem mesmo
    // depois dela ter saído de lá. Só a carreta importa aqui — trocar só o
    // cavalo não move nada de uma frota pra outra, já que a sincronização
    // agora resolve por carreta (ver sincronizarDisponibilidadeFrota).
    if (dados.carreta !== viagemAtual.carreta) {
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
    await recalcularAvisosInterjornada(tx, filialId, [
      viagemAtual.motoristaId,
      viagemAtualizada.motoristaId,
      viagemAtual.motoristaAcompanhanteId,
      viagemAtualizada.motoristaAcompanhanteId,
    ])
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
    await recalcularAvisosInterjornada(tx, filialId, [viagemDeletada.motoristaId, viagemDeletada.motoristaAcompanhanteId])
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

  // Postergar muda a data — os avisos de frota gravados na criação/última
  // edição são recalculados pra essa data nova, senão ficam "presos" no valor
  // de quando a viagem foi criada/editada pela última vez (ex: aviso de frota
  // indisponível que não valia mais pro horário novo). O de interjornada é
  // recalculado dentro da transação, pra qualquer mudança de status.
  const avisosRecalculados = novaData
    ? {
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
        finalizadoEm: calcularFinalizadoEm(status, viagemAtual.status),
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
    // Finalizar libera o motorista: a próxima viagem dele perde o aviso de
    // descanso se, contando da finalização, as 11h/35h já estão cumpridas.
    await recalcularAvisosInterjornada(tx, filialId, [viagemAtualizada.motoristaId, viagemAtualizada.motoristaAcompanhanteId])
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

  await garantirMotoristasValidos(filialId, {
    principalId: dados.motoristaId,
    acompanhanteId: dados.motoristaAcompanhanteId,
    produtoExigido: viagemAtual.produto,
    atuais: { principalId: viagemAtual.motoristaId, acompanhanteId: viagemAtual.motoristaAcompanhanteId },
  })

  const statusFinal = statusPermiteAutoAjuste(viagemAtual.status)
    ? resolverStatusPorAlocacao(dados.motoristaId)
    : viagemAtual.status

  return await prisma.$transaction(async (tx) => {
    const viagemAtualizada = await tx.viagem.update({
      where: { id: idViagem, filialId },
      data: {
        motoristaId: dados.motoristaId,
        motoristaAcompanhanteId: dados.motoristaAcompanhanteId,
        status: statusFinal,
        // Sem motorista não há descanso a avisar — o recálculo abaixo só
        // alcança viagens que têm motorista principal.
        ...(dados.motoristaId === null ? { avisoInterjornada: null } : {}),
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
    await recalcularAvisosInterjornada(tx, filialId, [
      viagemAtual.motoristaId,
      viagemAtualizada.motoristaId,
      viagemAtual.motoristaAcompanhanteId,
      viagemAtualizada.motoristaAcompanhanteId,
    ])
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