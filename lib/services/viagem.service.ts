import { prisma } from "@/lib/prisma";
import { turnoPorHorario } from "./turno";
import { NovaViagemInput, EditarViagemInput } from "@/lib/types/types";
import { buscarMotoristasParaSelect } from "@/lib/queries/motoristas";
import { buscarNumerosSapQueExigemIntegracao } from "@/lib/queries/clientes";
import {
  calcularIntegracaoExigida,
  motoristaAutorizadoParaProduto,
  sugerirMotoristaAutomatico,
} from "./alocacao.service";
import type { Prisma, StatusViagem, TipoProduto, Turno } from "@prisma/client";
import { reconciliarFolgaMotoristasNoDiaAtual } from "./folga.service";
import { registrarAuditoria, type Ator } from "./auditoria.service";
import { camposTravadosAlterados } from "./trava-chegada";
import { ErroDeDominio, MotoristaProdutoNaoAutorizadoError, MotoristaNaoEncontradoError, MotoristaEmTreinamentoError, MotoristaNaoViajaError, ViagemNaoEncontradaError, StatusViagemObrigatorioError, NumViagemDuplicadaError } from "@/lib/errors";
import { calcularAvisoFrotaIndisponivel, calcularAvisoFrotaProduto, sincronizarDisponibilidadeFrota } from "./frota.service";
import { converterEditarViagemParaBD, converterNovaViagemParaBD } from "./viagem-data-converter.service";
import { prepararJornadaDoMotorista } from "./jornada.service";
import { recalcularAvisosInterjornada } from "./interjornada.service";
import { podeSerAcompanhante, podeSerPrincipal } from "./tipo-motorista";
import { calcularDiasEntre, inicioDoDia } from "@/lib/utils/date-format";
import { STATUS_EM_ANDAMENTO } from "./viagem-status.service";

function resolverStatusPorAlocacao(motoristaId: number | null) {
  return motoristaId === null ? "CRIADA" : "ALOCADA";
}

/**
 * Turno ao editar: se o início mudou e quem editou não mexeu no turno, ele
 * acompanha o novo horário (ver turnoPorHorario). Se o turno foi trocado à
 * mão na edição, vale o escolhido.
 */
function turnoAposMudarHorario(
  viagemAtual: { inicioPrevisto: Date; turno: Turno },
  novoInicio: Date,
  turnoEnviado: Turno,
): Turno {
  const inicioAnterior = viagemAtual.inicioPrevisto ? new Date(viagemAtual.inicioPrevisto).getTime() : null
  const inicioMudou = inicioAnterior !== null && novoInicio.getTime() !== inicioAnterior
  if (!inicioMudou || turnoEnviado !== viagemAtual.turno) return turnoEnviado
  return turnoPorHorario(novoInicio) ?? turnoEnviado
}

function statusPermiteAutoAjuste(statusAtual: string) {
  return statusAtual === "CRIADA" || statusAtual === "ALOCADA"
}

/**
 * CRIADA e ALOCADA não são escolha de quem cadastra: dizem só se a viagem
 * tem motorista. Qualquer gravação passa por aqui pra "Criada com motorista"
 * (ou "Alocada sem motorista") nunca existir — antes, o formulário de nova
 * viagem mandava CRIADA mesmo com motorista escolhido. Os demais status
 * (EM_ANDAMENTO, CANCELADA...) passam intactos.
 */
function normalizarStatusPorAlocacao<S extends string>(status: S, motoristaId: number | null): S | "CRIADA" | "ALOCADA" {
  return statusPermiteAutoAjuste(status) ? resolverStatusPorAlocacao(motoristaId) : status
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
 * - o tipo precisa permitir o papel (ver tipo-motorista.ts): em treinamento
 *   só como acompanhante; enchedor não viaja; instrutor e interno podem ir
 *   em qualquer papel quando escolhidos à mão;
 * - o principal precisa estar autorizado pro produto da viagem (bloqueio
 *   rígido, mesmo nível de turno).
 *
 * Excluído/tipo só são cobrados de quem está ENTRANDO na viagem (diferente
 * de `atuais`): editar uma viagem antiga cujo motorista foi excluído ou
 * mudou de tipo depois não pode travar a edição dela.
 * Filial e produto valem sempre.
 */
export async function garantirMotoristasValidos(filialId: number, dados: MotoristasDaViagem) {
  const { principalId, acompanhanteId, produtoExigido, atuais } = dados

  if (principalId) {
    const principal = await buscarMotoristaDaFilial(filialId, principalId, principalId !== atuais?.principalId)

    if (principalId !== atuais?.principalId && !podeSerPrincipal(principal.tipo)) {
      throw principal.tipo === "ENCHEDOR" ? new MotoristaNaoViajaError() : new MotoristaEmTreinamentoError()
    }

    if (produtoExigido && !motoristaAutorizadoParaProduto(principal.produtosAutorizados, produtoExigido)) {
      throw new MotoristaProdutoNaoAutorizadoError()
    }
  }

  if (acompanhanteId) {
    const entrando = acompanhanteId !== atuais?.acompanhanteId
    const acompanhante = await buscarMotoristaDaFilial(filialId, acompanhanteId, entrando)

    if (entrando && !podeSerAcompanhante(acompanhante.tipo)) {
      throw new MotoristaNaoViajaError()
    }
  }
}

async function buscarMotoristaDaFilial(filialId: number, id: number, exigirAtivo: boolean) {
  const motorista = await prisma.motorista.findFirst({
    where: { id, filialId, ...(exigirAtivo ? { deletadoEm: null } : {}) },
    select: { produtosAutorizados: true, tipo: true },
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
    dados.fimPrevisto as Date,
  )
  const avisoFrotaProdutoIncompativel = await calcularAvisoFrotaProduto(filialId, dados.cavalo, dados.carreta, dados.produto)

  const statusInicial = normalizarStatusPorAlocacao(status ?? "CRIADA", motoristaId)

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
    ...prepararJornadaDoMotorista(motorista),
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

  const motoristaIdFinal = dados.motoristaId !== undefined ? dados.motoristaId : viagemAtual.motoristaId
  const statusFinal = normalizarStatusPorAlocacao(dados.status ?? viagemAtual.status, motoristaIdFinal ?? null)
  const turnoFinal = turnoAposMudarHorario(viagemAtual, dados.inicioPrevisto as Date, dados.turno)
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
    dados.fimPrevisto as Date,
    idViagem,
  )
  const avisoFrotaProdutoIncompativel = await calcularAvisoFrotaProduto(filialId, dados.cavalo, dados.carreta, dados.produto)

  // Viagem na estrada: trocar o principal por aqui apagaria o registro de
  // quem dirigiu até onde — a troca tem tela própria (km, local, motivo).
  const emAndamento = STATUS_EM_ANDAMENTO.includes(viagemAtual.status)
  if (emAndamento && viagemAtual.motoristaId !== null && motoristaIdFinal !== viagemAtual.motoristaId) {
    throw new ErroDeDominio("USAR_TROCA_DE_MOTORISTA", "A viagem já saiu: pra trocar o motorista, use \"Trocar motorista\" no fim desta tela.")
  }
  return await prisma.$transaction(async (tx) => {
    // Entrega com chegada registrada pelo motorista (medição do descarregado)
    // não pode sumir numa edição — levaria a medição junto, sem histórico.
    // Dentro da transação, com a viagem travada: a chegada gravada pelo
    // motorista também trava a viagem, então não escapa entre conferir e apagar.
    await tx.$queryRaw`SELECT id FROM "Viagem" WHERE id = ${idViagem} AND "filialId" = ${filialId} FOR UPDATE`
    const removidasComChegada = await tx.entrega.findMany({
      where: { viagemId: idViagem, id: { notIn: manterEntregas }, chegada: { isNot: null } },
      select: { cliente: true },
    })
    if (removidasComChegada.length > 0) {
      const clientes = removidasComChegada.map((entrega) => entrega.cliente).join(", ")
      throw new ErroDeDominio("ENTREGA_COM_CHEGADA", `Não dá pra remover ${clientes}: o motorista já registrou a chegada e a medição nessa entrega.`)
    }
    // E também não muda de cliente/lugar: a medição ficaria ligada a um
    // cliente onde ela não aconteceu (ver trava-chegada.ts).
    const mantidasComChegada = await tx.entrega.findMany({
      where: { viagemId: idViagem, id: { in: manterEntregas }, chegada: { isNot: null } },
      select: { id: true, cliente: true, cidade: true, uf: true, sapcode: true, codewhite: true },
    })
    for (const atual of mantidasComChegada) {
      const editada = entregasExistentes.find((entrega) => entrega.id === atual.id)
      const alterados = editada ? camposTravadosAlterados(atual, editada) : []
      if (alterados.length > 0) {
        throw new ErroDeDominio(
          "ENTREGA_COM_CHEGADA_ALTERADA",
          `Não dá pra mudar ${alterados.join(", ")} de ${atual.cliente}: o motorista já registrou a chegada e a medição nessa entrega. Se a chegada está errada, apague ela em "Registro do motorista" e depois edite.`,
        )
      }
    }

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
        turno: turnoFinal,
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
  return await prisma.$transaction(async (tx) => {
    // Lida já travada: o "antes" da auditoria é o estado que de fato sai.
    await tx.$queryRaw`SELECT id FROM "Viagem" WHERE id = ${id} AND "filialId" = ${filialId} FOR UPDATE`
    const viagemAntes = await tx.viagem.findUniqueOrThrow({ where: { id, filialId } })
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
type NovaDataViagem = { inicioPrevisto: Date; fimPrevisto: Date }

/**
 * Mudança de status feita pelo próprio motorista (celular): só grava se, NO
 * MOMENTO da escrita, a viagem ainda for dele e estiver num dos status
 * esperados — se o despacho cancelou, postergou, trocou o motorista ou
 * excluiu nesse meio-tempo, nada é gravado e sai VIAGEM_MUDOU.
 */
type CondicaoDoMotorista = {
  motoristaId: number
  statusEsperados: StatusViagem[]
  /** Gravado junto, na mesma escrita (km, saída real, motivo). */
  dados: Prisma.ViagemUpdateManyMutationInput
}

export const CODIGO_VIAGEM_MUDOU = "VIAGEM_MUDOU"

export async function atualizarStatusViagemService(
  filialId: number,
  idViagem: number,
  status: EditarViagemInput["status"],
  ator: Ator | null,
  novaData?: NovaDataViagem,
  condicao?: CondicaoDoMotorista,
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
        avisoFrotaIndisponivel: await calcularAvisoFrotaIndisponivel(
          filialId,
          viagemAtual.cavalo,
          viagemAtual.carreta,
          novaData.inicioPrevisto,
          novaData.fimPrevisto,
          idViagem,
        ),
        avisoFrotaProdutoIncompativel: await calcularAvisoFrotaProduto(filialId, viagemAtual.cavalo, viagemAtual.carreta, viagemAtual.produto),
      }
    : {}

  const statusFinal = normalizarStatusPorAlocacao(status, viagemAtual.motoristaId)

  return await prisma.$transaction(async (tx) => {
    const dados = {
      status: statusFinal,
      canceladoEm: calcularCanceladoEm(statusFinal, viagemAtual.status),
      finalizadoEm: calcularFinalizadoEm(statusFinal, viagemAtual.status),
      ...(novaData ? {
        inicioPrevisto: novaData.inicioPrevisto,
        fimPrevisto: novaData.fimPrevisto,
        diasViagem: calcularDiasEntre(novaData.inicioPrevisto, novaData.fimPrevisto),
        // Postergar da noite pro dia (ou o contrário) troca o turno — senão a
        // alocação procura motorista do turno errado.
        turno: turnoPorHorario(novaData.inicioPrevisto) ?? viagemAtual.turno,
      } : {}),
      ...avisosRecalculados,
    }
    let viagemAtualizada
    if (condicao) {
      const { count } = await tx.viagem.updateMany({
        where: {
          id: idViagem,
          filialId,
          deletadoEm: null,
          motoristaId: condicao.motoristaId,
          status: { in: condicao.statusEsperados },
        },
        data: { ...dados, ...condicao.dados },
      })
      if (count === 0) throw new ErroDeDominio(CODIGO_VIAGEM_MUDOU, "A viagem foi alterada pelo escalador. Atualize a tela.")
      viagemAtualizada = await tx.viagem.findUniqueOrThrow({ where: { id: idViagem } })
    } else {
      viagemAtualizada = await tx.viagem.update({ where: { id: idViagem, filialId }, data: dados })
    }

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