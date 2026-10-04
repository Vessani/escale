import type { Prisma, StatusViagem, TipoDespesaViagem } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { ErroDeDominio } from "@/lib/errors"
import { registrarAuditoria, type Ator } from "@/lib/services/auditoria.service"
import { montarRegistroChegada, type DadosChegada } from "@/lib/services/chegada-registro"
import { ehEntregaDeCliente } from "@/lib/services/entrega-cliente"
import { KM_MAXIMO_POR_VIAGEM, VALOR_MAXIMO_CENTAVOS, validarKmDoRegistro } from "@/lib/services/limites-registro"
import { STATUS_EM_ANDAMENTO } from "@/lib/services/viagem-status.service"
import { CAMPO_CONTEXTO_AUDITORIA } from "@/lib/utils/diff-auditoria"

/**
 * Correção feita pelo escalador no que o motorista registrou (km, pedágio e
 * pernoite, chegadas nos clientes) — inclusive depois de a viagem encerrar,
 * quando o motorista já não consegue mexer. Tudo vai pro histórico marcado
 * como "Correção do escalador".
 */

/** Viagens que já saíram: é aí que existe registro do motorista pra corrigir. */
const STATUS_CORRIGIVEIS: StatusViagem[] = [...STATUS_EM_ANDAMENTO, "FINALIZADA"]

const contexto = (numViagem: string, detalhe?: string) =>
  `Correção do escalador (viagem ${numViagem})${detalhe ? ` · ${detalhe}` : ""}`

const NAO_SAIU = () =>
  new ErroDeDominio("VIAGEM_NAO_INICIADA", "Só dá pra corrigir registros de viagem que já saiu (iniciada, retornando ou finalizada).")

/**
 * Trava a viagem (mesma trava do motorista e da edição) e devolve o estado
 * dela lido já travado — a correção nunca se baseia em leitura velha.
 */
async function travarViagem(tx: Prisma.TransactionClient, filialId: number, viagemId: number) {
  await tx.$queryRaw`SELECT id FROM "Viagem" WHERE id = ${viagemId} AND "filialId" = ${filialId} FOR UPDATE`
  const viagem = await tx.viagem.findFirst({
    where: { id: viagemId, filialId, deletadoEm: null },
    select: {
      id: true,
      numViagem: true,
      status: true,
      produto: true,
      kmInicial: true,
      kmFinal: true,
      horarioRealSaida: true,
      entregas: { select: { chegada: { select: { km: true } } } },
      trocas: { select: { km: true } },
    },
  })
  if (!viagem) throw new ErroDeDominio("VIAGEM_NAO_ENCONTRADA", "Viagem não encontrada nesta filial.")
  if (!STATUS_CORRIGIVEIS.includes(viagem.status)) throw NAO_SAIU()
  return viagem
}

// ---------------------------------------------------------------------------
// Km inicial e final
// ---------------------------------------------------------------------------

export async function corrigirKmPeloEscalador(
  filialId: number,
  viagemId: number,
  dados: { kmInicial: number; kmFinal: number | null },
  ator: Ator,
) {
  validarKmDoRegistro(dados.kmInicial, null, "Km inicial")
  if (dados.kmFinal !== null) {
    validarKmDoRegistro(dados.kmFinal, null, "Km final")
    if (dados.kmFinal < dados.kmInicial) throw new ErroDeDominio("KM_FINAL_MENOR", "O km final não pode ser menor que o inicial.")
    if (dados.kmFinal - dados.kmInicial > KM_MAXIMO_POR_VIAGEM) {
      throw new ErroDeDominio("KM_FINAL_ALTO", "Mais de 10.000 km rodados — confira os km.")
    }
  }

  return prisma.$transaction(async (tx) => {
    const viagem = await travarViagem(tx, filialId, viagemId)
    const encerrada = viagem.status === "FINALIZADA"
    if (encerrada && dados.kmFinal === null) throw new ErroDeDominio("KM_FINAL_OBRIGATORIO", "Viagem finalizada: informe o km final.")
    if (!encerrada && dados.kmFinal !== null) {
      throw new ErroDeDominio("KM_FINAL_SEM_ENCERRAR", "O km final só existe depois que a viagem é encerrada.")
    }

    // Chegadas e trocas têm que continuar dentro do trecho rodado.
    const kmsNoCaminho = [
      ...viagem.entregas.flatMap((entrega) => (entrega.chegada ? [entrega.chegada.km] : [])),
      ...viagem.trocas.map((troca) => troca.km),
    ]
    if (kmsNoCaminho.some((km) => km < dados.kmInicial)) {
      throw new ErroDeDominio("KM_INICIAL_ALTO", `Há chegada ou troca com km menor que ${dados.kmInicial} — corrija esses registros antes.`)
    }
    if (dados.kmFinal !== null && kmsNoCaminho.some((km) => km > (dados.kmFinal as number))) {
      throw new ErroDeDominio("KM_FINAL_BAIXO", `Há chegada ou troca com km maior que ${dados.kmFinal} — corrija esses registros antes.`)
    }

    const antes = { kmInicial: viagem.kmInicial, kmFinal: viagem.kmFinal }
    const depois = { kmInicial: dados.kmInicial, kmFinal: dados.kmFinal }
    await tx.viagem.update({ where: { id: viagem.id }, data: depois })
    await registrarAuditoria(tx, {
      entidade: "Viagem",
      entidadeId: viagem.id,
      acao: "ATUALIZACAO",
      antes,
      depois: { ...depois, [CAMPO_CONTEXTO_AUDITORIA]: contexto(viagem.numViagem, "km") },
      ator,
      filialId,
    })
    return { viagemId: viagem.id }
  })
}

// ---------------------------------------------------------------------------
// Pedágio e pernoite
// ---------------------------------------------------------------------------

type DadosDespesa = { tipo: TipoDespesaViagem; valorCentavos: number }

function validarValor(valorCentavos: number) {
  if (!Number.isInteger(valorCentavos) || valorCentavos <= 0 || valorCentavos > VALOR_MAXIMO_CENTAVOS) {
    throw new ErroDeDominio("VALOR_INVALIDO", "Informe um valor entre R$ 0,01 e R$ 10.000,00.")
  }
}

const rotuloDespesa = (tipo: TipoDespesaViagem) => (tipo === "PEDAGIO" ? "pedágio" : "pernoite")

export async function lancarDespesaPeloEscalador(filialId: number, viagemId: number, dados: DadosDespesa, ator: Ator) {
  validarValor(dados.valorCentavos)
  return prisma.$transaction(async (tx) => {
    const viagem = await travarViagem(tx, filialId, viagemId)
    const despesa = await tx.despesaViagem.create({
      data: { viagemId: viagem.id, tipo: dados.tipo, valorCentavos: dados.valorCentavos, usuarioId: ator.usuarioId },
    })
    await registrarAuditoria(tx, {
      entidade: "DespesaViagem",
      entidadeId: despesa.id,
      acao: "CRIACAO",
      depois: { ...despesa, [CAMPO_CONTEXTO_AUDITORIA]: contexto(viagem.numViagem, rotuloDespesa(dados.tipo)) },
      ator,
      filialId,
    })
    return { viagemId: viagem.id }
  })
}

/** Despesa ativa desta filial — a viagem dela é travada antes de mexer. */
async function despesaDaFilial(filialId: number, despesaId: number) {
  const despesa = await prisma.despesaViagem.findFirst({
    where: { id: despesaId, deletadoEm: null, viagem: { filialId, deletadoEm: null } },
    select: { viagemId: true },
  })
  if (!despesa) throw new ErroDeDominio("DESPESA_NAO_ENCONTRADA", "Lançamento não encontrado.")
  return despesa
}

export async function corrigirDespesaPeloEscalador(filialId: number, despesaId: number, dados: DadosDespesa, ator: Ator) {
  validarValor(dados.valorCentavos)
  const { viagemId } = await despesaDaFilial(filialId, despesaId)
  return prisma.$transaction(async (tx) => {
    const viagem = await travarViagem(tx, filialId, viagemId)
    // Relido com a viagem travada: pode ter sido apagada no meio-tempo.
    const antes = await tx.despesaViagem.findFirst({ where: { id: despesaId, viagemId, deletadoEm: null } })
    if (!antes) throw new ErroDeDominio("DESPESA_NAO_ENCONTRADA", "Lançamento não encontrado.")
    const depois = await tx.despesaViagem.update({ where: { id: despesaId }, data: { tipo: dados.tipo, valorCentavos: dados.valorCentavos } })
    await registrarAuditoria(tx, {
      entidade: "DespesaViagem",
      entidadeId: despesaId,
      acao: "ATUALIZACAO",
      antes,
      depois: { ...depois, [CAMPO_CONTEXTO_AUDITORIA]: contexto(viagem.numViagem, rotuloDespesa(dados.tipo)) },
      ator,
      filialId,
    })
    return { viagemId }
  })
}

/** Apaga (com data de exclusão — continua no histórico). */
export async function removerDespesaPeloEscalador(filialId: number, despesaId: number, ator: Ator) {
  const { viagemId } = await despesaDaFilial(filialId, despesaId)
  return prisma.$transaction(async (tx) => {
    const viagem = await travarViagem(tx, filialId, viagemId)
    const antes = await tx.despesaViagem.findFirst({ where: { id: despesaId, viagemId, deletadoEm: null } })
    if (!antes) throw new ErroDeDominio("DESPESA_NAO_ENCONTRADA", "Lançamento não encontrado.")
    await tx.despesaViagem.update({ where: { id: despesaId }, data: { deletadoEm: new Date() } })
    await registrarAuditoria(tx, {
      entidade: "DespesaViagem",
      entidadeId: despesaId,
      acao: "EXCLUSAO",
      antes: { ...antes, [CAMPO_CONTEXTO_AUDITORIA]: contexto(viagem.numViagem, rotuloDespesa(antes.tipo)) },
      ator,
      filialId,
    })
    return { viagemId }
  })
}

// ---------------------------------------------------------------------------
// Chegadas nos clientes
// ---------------------------------------------------------------------------

/** Registra ou corrige a chegada num cliente — mesmas regras do motorista, e dentro do km final se a viagem já encerrou. */
export async function salvarChegadaPeloEscalador(filialId: number, entregaId: number, dados: DadosChegada, ator: Ator, agora = new Date()) {
  const entrega = await prisma.entrega.findFirst({
    where: { id: entregaId, viagem: { filialId, deletadoEm: null } },
    select: { viagemId: true, cliente: true, sapcode: true, codewhite: true },
  })
  if (!entrega || !ehEntregaDeCliente(entrega)) throw new ErroDeDominio("ENTREGA_NAO_ENCONTRADA", "Entrega não encontrada nesta filial.")

  return prisma.$transaction(async (tx) => {
    const viagem = await travarViagem(tx, filialId, entrega.viagemId)
    const registro = montarRegistroChegada(dados, viagem, ator.usuarioId, agora)
    if (viagem.kmFinal !== null && registro.km > viagem.kmFinal) {
      throw new ErroDeDominio("KM_ACIMA_DO_FINAL", `Km da chegada: não pode passar do km final (${viagem.kmFinal}).`)
    }
    const antes = await tx.chegadaEntrega.findUnique({ where: { entregaId } })
    const depois = await tx.chegadaEntrega.upsert({ where: { entregaId }, create: { entregaId, ...registro }, update: registro })
    await registrarAuditoria(tx, {
      entidade: "ChegadaEntrega",
      entidadeId: depois.id,
      acao: antes ? "ATUALIZACAO" : "CRIACAO",
      antes: antes ?? undefined,
      depois: { ...depois, [CAMPO_CONTEXTO_AUDITORIA]: contexto(viagem.numViagem, `chegada em ${entrega.cliente}`) },
      ator,
      filialId,
    })
    return { viagemId: viagem.id }
  })
}

/**
 * Apaga uma chegada lançada no cliente errado — a entrega volta a poder ser
 * editada (ver trava-chegada.ts). O registro apagado fica no histórico.
 */
export async function apagarChegadaPeloEscalador(filialId: number, chegadaId: number, ator: Ator) {
  const chegada = await prisma.chegadaEntrega.findFirst({
    where: { id: chegadaId, entrega: { viagem: { filialId, deletadoEm: null } } },
    include: { entrega: { select: { cliente: true, viagemId: true, viagem: { select: { numViagem: true } } } } },
  })
  if (!chegada) throw new ErroDeDominio("CHEGADA_NAO_ENCONTRADA", "Chegada não encontrada nesta filial.")
  const { entrega, ...antes } = chegada

  await prisma.$transaction(async (tx) => {
    // Mesma trava do motorista e da edição: não apaga no meio de outra gravação.
    await tx.$queryRaw`SELECT id FROM "Viagem" WHERE id = ${entrega.viagemId} AND "filialId" = ${filialId} FOR UPDATE`
    await tx.chegadaEntrega.delete({ where: { id: chegadaId } })
    await registrarAuditoria(tx, {
      entidade: "ChegadaEntrega",
      entidadeId: chegadaId,
      acao: "EXCLUSAO",
      antes: { ...antes, [CAMPO_CONTEXTO_AUDITORIA]: `Chegada em ${entrega.cliente} (viagem ${entrega.viagem.numViagem})` },
      ator,
      filialId,
    })
  })
  return { viagemId: entrega.viagemId }
}
