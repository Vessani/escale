import type { Prisma, StatusViagem, TipoDespesaViagem } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { ErroDeDominio, ViagemNaoEncontradaError } from "@/lib/errors"
import { inicioDoDia } from "@/lib/utils/date-format"
import { minutosDeAtraso, saidaAtrasada } from "@/lib/services/pontualidade"
import { TAMANHO_MAXIMO_MOTIVO } from "@/lib/services/motivos-atraso"
import { registrarAuditoria, type Ator } from "@/lib/services/auditoria.service"
import { atualizarStatusViagemService } from "@/lib/services/viagem.service"

/**
 * Área do motorista ("Minhas viagens"): o que ele vê e o que ele registra.
 * Toda consulta é escopada pela filial E pelo motorista do acesso — nunca
 * por um id vindo da tela sozinho.
 *
 * Quem registra (iniciar, despesas, encerrar) é o motorista PRINCIPAL; o
 * acompanhante vê a viagem, mas não mexe.
 */

const UM_DIA_MS = 24 * 60 * 60 * 1000

/** Ainda não saiu. */
export const STATUS_A_INICIAR: StatusViagem[] = ["CRIADA", "ALOCADA", "POSTERGADA"]
/** Na estrada. */
export const STATUS_EM_ANDAMENTO: StatusViagem[] = ["INICIADA", "RETORNANDO"]

/** Hodômetro: até 9.999.999 km; uma viagem não roda mais que isso. */
const KM_MAXIMO = 9_999_999
const KM_MAXIMO_POR_VIAGEM = 10_000
/** R$ 10.000,00 por lançamento — acima disso é erro de digitação. */
const VALOR_MAXIMO_CENTAVOS = 1_000_000

const selecaoViagem = {
  id: true,
  numViagem: true,
  status: true,
  cavalo: true,
  carreta: true,
  produto: true,
  inicioPrevisto: true,
  fimPrevisto: true,
  horarioRealSaida: true,
  motivoAtraso: true,
  finalizadoEm: true,
  kmInicial: true,
  kmFinal: true,
  motoristaId: true,
  motorista: { select: { nome: true } },
  motoristaAcompanhante: { select: { nome: true } },
  entregas: {
    orderBy: { dataEntrega: "asc" as const },
    select: { id: true, cliente: true, cidade: true, uf: true, dataEntrega: true },
  },
  despesas: {
    where: { deletadoEm: null },
    orderBy: { registradoEm: "asc" as const },
    select: { id: true, tipo: true, valorCentavos: true, registradoEm: true, usuarioId: true },
  },
}

function doMotorista(motoristaId: number) {
  return { OR: [{ motoristaId }, { motoristaAcompanhanteId: motoristaId }] }
}

/**
 * Viagens que aparecem pro motorista: as em andamento, as que ainda vão
 * sair (de ontem em diante — viagem atrasada de ontem ainda aparece) e as
 * finalizadas nas últimas 24h, pra ele conferir o que lançou.
 */
export async function buscarMinhasViagens(filialId: number, motoristaId: number, agora = new Date()) {
  const ontem = new Date(inicioDoDia(agora).getTime() - UM_DIA_MS)
  return prisma.viagem.findMany({
    where: {
      filialId,
      deletadoEm: null,
      // AND explícito: dois "OR" no mesmo objeto se sobrescrevem (e o filtro
      // do motorista sumiria — ele veria viagens dos outros).
      AND: [
        doMotorista(motoristaId),
        {
          OR: [
            { status: { in: STATUS_EM_ANDAMENTO } },
            { status: { in: STATUS_A_INICIAR }, inicioPrevisto: { gte: ontem } },
            { status: "FINALIZADA", finalizadoEm: { gte: new Date(agora.getTime() - UM_DIA_MS) } },
          ],
        },
      ],
    },
    orderBy: { inicioPrevisto: "asc" },
    select: selecaoViagem,
  })
}

export type MinhaViagem = Awaited<ReturnType<typeof buscarMinhasViagens>>[number]

export async function buscarMinhaViagem(filialId: number, motoristaId: number, viagemId: number) {
  return prisma.viagem.findFirst({
    where: { id: viagemId, filialId, deletadoEm: null, ...doMotorista(motoristaId) },
    select: selecaoViagem,
  })
}

/** A viagem, só se este motorista for o principal dela — senão "não encontrada" (não revela que existe). */
async function viagemDoPrincipal(filialId: number, motoristaId: number, viagemId: number) {
  const viagem = await prisma.viagem.findFirst({
    where: { id: viagemId, filialId, deletadoEm: null, motoristaId },
  })
  if (!viagem) throw new ViagemNaoEncontradaError()
  return viagem
}

type Transacao = Parameters<Parameters<typeof prisma.$transaction>[0]>[0]

/**
 * Grava só se a viagem ainda estiver num dos status esperados NO MOMENTO da
 * escrita — toque duplo ou dois celulares ao mesmo tempo não iniciam/encerram
 * duas vezes (o segundo recebe o erro).
 */
async function gravarSeStatus(
  tx: Transacao,
  alvo: { viagemId: number; filialId: number; motoristaId: number },
  statusEsperados: StatusViagem[],
  data: Prisma.ViagemUpdateManyMutationInput,
  codigoErro: string,
  mensagemErro: string,
) {
  const { count } = await tx.viagem.updateMany({
    where: { id: alvo.viagemId, filialId: alvo.filialId, motoristaId: alvo.motoristaId, deletadoEm: null, status: { in: statusEsperados } },
    data,
  })
  if (count === 0) throw new ErroDeDominio(codigoErro, mensagemErro)
  return tx.viagem.findUniqueOrThrow({ where: { id: alvo.viagemId } })
}

function validarKm(km: number, campo: string) {
  if (!Number.isInteger(km) || km < 0 || km > KM_MAXIMO) {
    throw new ErroDeDominio("KM_INVALIDO", `${campo}: informe o número do hodômetro, só números.`)
  }
}

/**
 * Motorista inicia a viagem: grava km inicial e saída real (agora) e muda o
 * status pra Iniciada — o Dashboard do despacho passa a mostrar na hora.
 * Saída depois da tolerância exige o motivo do atraso.
 */
export async function iniciarMinhaViagem(
  filialId: number,
  motoristaId: number,
  viagemId: number,
  dados: { kmInicial: number; motivoAtraso: string | null },
  ator: Ator,
  agora = new Date(),
) {
  const viagem = await viagemDoPrincipal(filialId, motoristaId, viagemId)
  if (!STATUS_A_INICIAR.includes(viagem.status)) {
    throw new ErroDeDominio("VIAGEM_JA_INICIADA", "Essa viagem já foi iniciada.")
  }
  validarKm(dados.kmInicial, "Km inicial")

  const motivo = dados.motivoAtraso?.trim().slice(0, TAMANHO_MAXIMO_MOTIVO) || null
  const atrasada = saidaAtrasada(minutosDeAtraso(viagem.inicioPrevisto, agora))
  if (atrasada && !motivo) {
    throw new ErroDeDominio("MOTIVO_ATRASO_OBRIGATORIO", "A saída está atrasada: informe o motivo.")
  }

  await prisma.$transaction(async (tx) => {
    const depois = await gravarSeStatus(tx, { viagemId, filialId, motoristaId }, STATUS_A_INICIAR, {
      kmInicial: dados.kmInicial,
      horarioRealSaida: agora,
      motivoAtraso: atrasada ? motivo : null,
    }, "VIAGEM_JA_INICIADA", "Essa viagem já foi iniciada.")
    await registrarAuditoria(tx, { entidade: "Viagem", entidadeId: viagemId, acao: "ATUALIZACAO", antes: viagem, depois, ator, filialId })
  })
  await atualizarStatusViagemService(filialId, viagemId, "INICIADA", ator)
}

/** Lança um pedágio ou pernoite na viagem em andamento. */
export async function adicionarMinhaDespesa(
  filialId: number,
  motoristaId: number,
  viagemId: number,
  dados: { tipo: TipoDespesaViagem; valorCentavos: number },
  ator: Ator,
) {
  const viagem = await viagemDoPrincipal(filialId, motoristaId, viagemId)
  if (!STATUS_EM_ANDAMENTO.includes(viagem.status)) {
    throw new ErroDeDominio("VIAGEM_NAO_INICIADA", "Inicie a viagem antes de lançar pedágio ou pernoite.")
  }
  if (!Number.isInteger(dados.valorCentavos) || dados.valorCentavos <= 0 || dados.valorCentavos > VALOR_MAXIMO_CENTAVOS) {
    throw new ErroDeDominio("VALOR_INVALIDO", "Informe um valor entre R$ 0,01 e R$ 10.000,00.")
  }

  return prisma.$transaction(async (tx) => {
    const despesa = await tx.despesaViagem.create({
      data: { viagemId, tipo: dados.tipo, valorCentavos: dados.valorCentavos, usuarioId: ator.usuarioId },
    })
    await registrarAuditoria(tx, { entidade: "DespesaViagem", entidadeId: despesa.id, acao: "CRIACAO", depois: despesa, ator, filialId })
    return despesa
  })
}

/** Apaga um lançamento feito por engano — só os dele, e só com a viagem ainda em andamento. */
export async function removerMinhaDespesa(filialId: number, motoristaId: number, despesaId: number, ator: Ator) {
  const despesa = await prisma.despesaViagem.findFirst({
    where: { id: despesaId, deletadoEm: null, usuarioId: ator.usuarioId, viagem: { filialId, motoristaId, deletadoEm: null } },
    include: { viagem: { select: { status: true } } },
  })
  if (!despesa) throw new ErroDeDominio("DESPESA_NAO_ENCONTRADA", "Lançamento não encontrado.")
  if (!STATUS_EM_ANDAMENTO.includes(despesa.viagem.status)) {
    throw new ErroDeDominio("VIAGEM_ENCERRADA", "A viagem já foi encerrada — peça a correção ao despacho.")
  }

  await prisma.$transaction(async (tx) => {
    const { viagem, ...antes } = despesa
    void viagem
    const depois = await tx.despesaViagem.update({ where: { id: despesaId }, data: { deletadoEm: new Date() } })
    await registrarAuditoria(tx, { entidade: "DespesaViagem", entidadeId: despesaId, acao: "EXCLUSAO", antes, depois, ator, filialId })
  })
}

/** Encerra: grava o km final e finaliza a viagem (o descanso dele passa a contar daqui). */
export async function encerrarMinhaViagem(
  filialId: number,
  motoristaId: number,
  viagemId: number,
  dados: { kmFinal: number },
  ator: Ator,
) {
  const viagem = await viagemDoPrincipal(filialId, motoristaId, viagemId)
  if (!STATUS_EM_ANDAMENTO.includes(viagem.status)) {
    throw new ErroDeDominio("VIAGEM_NAO_INICIADA", "Só dá pra encerrar uma viagem em andamento.")
  }
  validarKm(dados.kmFinal, "Km final")
  if (viagem.kmInicial !== null) {
    if (dados.kmFinal < viagem.kmInicial) {
      throw new ErroDeDominio("KM_FINAL_MENOR", `O km final não pode ser menor que o inicial (${viagem.kmInicial}).`)
    }
    if (dados.kmFinal - viagem.kmInicial > KM_MAXIMO_POR_VIAGEM) {
      throw new ErroDeDominio("KM_FINAL_ALTO", "Mais de 10.000 km rodados — confira o km final.")
    }
  }

  await prisma.$transaction(async (tx) => {
    const depois = await gravarSeStatus(tx, { viagemId, filialId, motoristaId }, STATUS_EM_ANDAMENTO, { kmFinal: dados.kmFinal },
      "VIAGEM_NAO_INICIADA", "Só dá pra encerrar uma viagem em andamento.")
    await registrarAuditoria(tx, { entidade: "Viagem", entidadeId: viagemId, acao: "ATUALIZACAO", antes: viagem, depois, ator, filialId })
  })
  await atualizarStatusViagemService(filialId, viagemId, "FINALIZADA", ator)
}
