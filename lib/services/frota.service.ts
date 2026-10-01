import type { Prisma, TipoProduto } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { converterEntradaDeDataHora, formatarDataHoraPtBr } from "@/lib/utils/date-format"
import { formatarProduto } from "./produto.service"
import { frotaEhValida } from "./frota-regras"
import { avisoManutencaoNaViagem, type ManutencaoBase } from "./manutencao-regras"
import { registrarAuditoria, type Ator } from "./auditoria.service"
import { FrotaDuplicadaError } from "@/lib/errors"

export { frotaEhValida } from "./frota-regras"

export type FrotaInput = {
  cavalo: string
  carreta: string
  disponivelEm?: string | Date | null
  tipoProduto?: TipoProduto | null
}

type FrotaParaAviso = { disponivelEm: Date | null }

type ViagemAtivaDaCarreta = {
  id: number
  numViagem: string
  inicioPrevisto: Date
  fimPrevisto: Date
}

type ViagemAvaliada = { id?: number; inicio: Date; fim: Date }

/** Viagens que ainda "seguram" a carreta — mesmo critério de sincronizarDisponibilidadeFrota. */
function filtroViagensAtivasDaCarreta(filialId: number, carreta: string) {
  return {
    carreta,
    filialId,
    deletadoEm: null,
    status: { notIn: ["CANCELADA" as const, "FINALIZADA" as const] },
  }
}

const SELECT_VIAGEM_ATIVA_DA_CARRETA = {
  id: true,
  numViagem: true,
  inicioPrevisto: true,
  fimPrevisto: true,
} as const

/**
 * Regra pura do aviso de frota indisponível pra uma viagem, a partir do
 * conjunto cadastrado, das manutenções do cavalo e da carreta e das viagens
 * ativas da mesma carreta:
 * 1. Cavalo ou carreta em manutenção no período da viagem avisa (ver
 *    avisoManutencaoNaViagem). Vale mesmo sem conjunto cadastrado.
 * 2. Outra viagem ativa da carreta com período sobreposto avisa, citando
 *    ela. A própria viagem (`avaliada.id`) é ignorada — antes o aviso vinha
 *    de `disponivelEm`, que é o MAIOR fim previsto entre as viagens ativas
 *    da carreta incluindo a própria: editar qualquer viagem fazia ela
 *    conflitar consigo mesma, e uma viagem da semana seguinte na mesma
 *    carreta marcava as de hoje como indisponíveis.
 * 3. `disponivelEm` só vale quando não é o fim de nenhuma viagem ativa —
 *    ou seja, foi preenchido à mão no cadastro (ex: liberação prevista).
 */
export function avaliarAvisoFrotaIndisponivel(
  frota: FrotaParaAviso | null,
  viagensAtivas: ViagemAtivaDaCarreta[],
  avaliada: ViagemAvaliada,
  cavalo: string,
  carreta: string,
  manutencoes: ManutencaoBase[] = [],
  agora: Date = new Date(),
): string | null {
  const avisoManutencao = avisoManutencaoNaViagem(manutencoes, cavalo, carreta, avaliada.inicio, avaliada.fim, agora)
  if (avisoManutencao) {
    return avisoManutencao
  }

  // Conjunto não cadastrado: só a manutenção vale (ver calcularAvisoFrotaIndisponivel).
  if (!frota) {
    return null
  }

  const conflito = viagensAtivas
    .filter((viagem) => viagem.id !== avaliada.id)
    .filter((viagem) => viagem.inicioPrevisto < avaliada.fim && viagem.fimPrevisto > avaliada.inicio)
    .sort((a, b) => b.fimPrevisto.getTime() - a.fimPrevisto.getTime())[0]

  if (conflito) {
    return `Frota ${cavalo}/${carreta} em uso na viagem ${conflito.numViagem} até ${formatarDataHoraPtBr(conflito.fimPrevisto)}.`
  }

  const disponivelEm = frota.disponivelEm
  if (!disponivelEm || disponivelEm <= avaliada.inicio) {
    return null
  }

  const ehFimDeViagem = viagensAtivas.some((viagem) => viagem.fimPrevisto.getTime() === disponivelEm.getTime())
  if (ehFimDeViagem) {
    return null
  }

  return `Frota ${cavalo}/${carreta} só estará disponível a partir de ${formatarDataHoraPtBr(disponivelEm)}.`
}

/**
 * Aviso de frota indisponível pra uma viagem prestes a ser gravada (ver
 * avaliarAvisoFrotaIndisponivel). Consulta só pela carreta (o cliente não
 * liga pra qual cavalo está puxando, e corrigir cavalo digitado errado
 * viagem por viagem é trabalho demais) — o cadastro em si continua sendo a
 * dupla cavalo+carreta (ver criarFrotaService). Se houver mais de um conjunto
 * ativo cadastrado pra mesma carreta (cavalo diferente), usa o mais
 * recentemente atualizado. Não bloqueia a criação/edição — só retorna uma
 * mensagem de aviso (ou null), no mesmo espírito do avisoInterjornada.
 * `viagemId` é a própria viagem sendo editada (ausente numa viagem nova).
 */
export async function calcularAvisoFrotaIndisponivel(
  filialId: number,
  cavalo: string,
  carreta: string,
  inicio: Date,
  fim: Date,
  viagemId?: number,
): Promise<string | null> {
  if (!frotaEhValida(carreta)) {
    return null
  }

  const [frota, manutencoes] = await Promise.all([
    prisma.frota.findFirst({
      where: { carreta, filialId, deletadoEm: null },
      orderBy: { atualizadoEm: "desc" },
    }),
    buscarManutencoesDosVeiculos(prisma, filialId, [cavalo], [carreta]),
  ])

  // Sem conjunto cadastrado, o aviso de viagem sobreposta não vale (a viagem
  // é texto livre) — mas a manutenção do veículo vale.
  const viagensAtivas = frota
    ? await prisma.viagem.findMany({
        where: filtroViagensAtivasDaCarreta(filialId, carreta),
        select: SELECT_VIAGEM_ATIVA_DA_CARRETA,
      })
    : []

  return avaliarAvisoFrotaIndisponivel(frota, viagensAtivas, { id: viagemId, inicio, fim }, cavalo, carreta, manutencoes)
}

/** Manutenções não excluídas dos cavalos/carretas informados (as concluídas também — o período pode cruzar o da viagem). */
export async function buscarManutencoesDosVeiculos(
  cliente: Pick<Prisma.TransactionClient, "manutencao">,
  filialId: number,
  cavalos: string[],
  carretas: string[],
): Promise<ManutencaoBase[]> {
  const codigosCavalo = [...new Set(cavalos.filter(frotaEhValida))]
  const codigosCarreta = [...new Set(carretas.filter(frotaEhValida))]
  if (codigosCavalo.length === 0 && codigosCarreta.length === 0) return []

  return cliente.manutencao.findMany({
    where: {
      filialId,
      deletadoEm: null,
      OR: [
        ...(codigosCavalo.length ? [{ veiculo: "CAVALO" as const, codigo: { in: codigosCavalo } }] : []),
        ...(codigosCarreta.length ? [{ veiculo: "CARRETA" as const, codigo: { in: codigosCarreta } }] : []),
      ],
    },
  })
}

/**
 * Avisa quando a frota cadastrada pra essa carreta é dedicada a um produto
 * diferente do exigido pela viagem. Consulta só pela carreta, mesmo
 * critério de calcularAvisoFrotaIndisponivel (ver comentário lá) — usa o
 * conjunto mais recentemente atualizado se houver mais de um ativo pra
 * mesma carreta. Só aviso, nunca bloqueia — cavalo/carreta na viagem é
 * texto livre, pode nem ter frota cadastrada ainda (ver comentário em
 * sincronizarDisponibilidadeFrota sobre o cadastro de frota ser fechado).
 */
export async function calcularAvisoFrotaProduto(
  filialId: number,
  cavalo: string,
  carreta: string,
  produtoViagem: TipoProduto | null | undefined,
): Promise<string | null> {
  if (!produtoViagem || !frotaEhValida(cavalo) || !frotaEhValida(carreta)) {
    return null
  }

  const frota = await prisma.frota.findFirst({
    where: { carreta, filialId, deletadoEm: null },
    orderBy: { atualizadoEm: "desc" },
  })

  if (!frota || !frota.tipoProduto || frota.tipoProduto === produtoViagem) {
    return null
  }

  return `Frota ${cavalo}/${carreta} está cadastrada para ${formatarProduto(frota.tipoProduto)}, não ${formatarProduto(produtoViagem)}.`
}

/**
 * Recalcula a disponibilidade da frota cadastrada pra essa carreta a partir
 * de TODAS as viagens ativas dela na filial (nem CANCELADA nem FINALIZADA,
 * sem soft delete) — disponivelEm vira o maior fimPrevisto entre elas, ou
 * null se não sobrar nenhuma (frota livre agora). Tanto a busca do conjunto
 * quanto a das viagens ativas consideram só a carreta — o cliente não liga
 * pra qual cavalo está puxando (ver calcularAvisoFrotaIndisponivel); se
 * houver mais de um conjunto ativo pra mesma carreta, atualiza o mais
 * recentemente atualizado.
 *
 * Só atualiza um conjunto já cadastrado (ver criarFrotaService) — nunca
 * cadastra um novo. O cadastro de frota é fechado: a empresa tem uma frota
 * própria conhecida, e usar uma viagem com cavalo/carreta fora desse cadastro
 * é considerado dado incompleto/errado na viagem, não motivo pra criar um
 * conjunto novo sozinho.
 *
 * Precisa ser chamado sempre que uma viagem que usa essa frota muda de
 * estado: criada, editada (na carreta antiga também, se a carreta mudou),
 * teve o status alterado, ou foi excluída — senão cancelar/finalizar uma
 * viagem nunca libera a frota (fica presa no fim previsto antigo pra sempre).
 * Também recalcula o avisoFrotaIndisponivel de todas as viagens ativas da
 * carreta (ver avaliarAvisoFrotaIndisponivel).
 *
 * Sem RegistroAuditoria própria de propósito: é um recálculo automático
 * disparado por escrita de Viagem, não uma decisão de alguém — a viagem que
 * disparou essa sincronização já tem sua própria auditoria.
 */
export async function sincronizarDisponibilidadeFrota(
  tx: Prisma.TransactionClient,
  filialId: number,
  cavalo: string,
  carreta: string,
): Promise<void> {
  if (!frotaEhValida(carreta)) {
    return
  }

  const existente = await tx.frota.findFirst({
    where: { carreta, filialId, deletadoEm: null },
    orderBy: { atualizadoEm: "desc" },
  })

  const viagensAtivas = await tx.viagem.findMany({
    where: filtroViagensAtivasDaCarreta(filialId, carreta),
    select: { ...SELECT_VIAGEM_ATIVA_DA_CARRETA, cavalo: true, avisoFrotaIndisponivel: true },
  })

  const maiorFim = viagensAtivas.reduce<Date | null>(
    (maior, viagem) => (!maior || viagem.fimPrevisto > maior ? viagem.fimPrevisto : maior),
    null,
  )

  // Conjunto não cadastrado: não há disponivelEm pra atualizar, mas o aviso
  // de manutenção das viagens ainda precisa ser recalculado.
  if (existente) {
    await tx.frota.update({
      where: { id: existente.id, filialId },
      data: { disponivelEm: maiorFim },
    })
  }
  const frotaAtualizada = existente ? { disponivelEm: maiorFim } : null
  const manutencoes = await buscarManutencoesDosVeiculos(
    tx,
    filialId,
    [cavalo, ...viagensAtivas.map((viagem) => viagem.cavalo)],
    [carreta],
  )

  // Uma viagem cancelada/finalizada/movida libera (ou ocupa) a carreta pras
  // outras: recalcula o aviso gravado em todas as viagens ativas dela, senão
  // ele fica "preso" no valor da última vez que cada uma foi salva.
  for (const viagem of viagensAtivas) {
    const aviso = avaliarAvisoFrotaIndisponivel(
      frotaAtualizada,
      viagensAtivas,
      { id: viagem.id, inicio: viagem.inicioPrevisto, fim: viagem.fimPrevisto },
      viagem.cavalo,
      carreta,
      manutencoes,
    )

    if (aviso !== viagem.avisoFrotaIndisponivel) {
      await tx.viagem.update({ where: { id: viagem.id, filialId }, data: { avisoFrotaIndisponivel: aviso } })
    }
  }
}

/** Cria um conjunto manualmente pelo cadastro. */
export async function criarFrotaService(filialId: number, dados: FrotaInput, ator: Ator | null) {
  const existente = await prisma.frota.findFirst({
    where: { cavalo: dados.cavalo, carreta: dados.carreta, filialId, deletadoEm: null },
  })

  if (existente) {
    throw new FrotaDuplicadaError()
  }

  return prisma.$transaction(async (tx) => {
    const frotaCriada = await tx.frota.create({
      data: {
        cavalo: dados.cavalo,
        carreta: dados.carreta,
        disponivelEm: dados.disponivelEm ? converterEntradaDeDataHora(dados.disponivelEm) : null,
        tipoProduto: dados.tipoProduto ?? null,
        filialId,
      },
    })

    await registrarAuditoria(tx, {
      entidade: "Frota",
      entidadeId: frotaCriada.id,
      acao: "CRIACAO",
      depois: frotaCriada,
      ator,
      filialId,
    })

    return frotaCriada
  })
}

export async function editarFrotaService(filialId: number, id: number, dados: FrotaInput, ator: Ator | null) {
  const existente = await prisma.frota.findFirst({
    where: { cavalo: dados.cavalo, carreta: dados.carreta, filialId, deletadoEm: null, id: { not: id } },
  })

  if (existente) {
    throw new FrotaDuplicadaError()
  }

  const frotaAntes = await prisma.frota.findUniqueOrThrow({ where: { id, filialId } })

  return prisma.$transaction(async (tx) => {
    const frotaAtualizada = await tx.frota.update({
      where: { id, filialId },
      data: {
        cavalo: dados.cavalo,
        carreta: dados.carreta,
        disponivelEm: dados.disponivelEm ? converterEntradaDeDataHora(dados.disponivelEm) : null,
        tipoProduto: dados.tipoProduto ?? null,
      },
    })

    await registrarAuditoria(tx, {
      entidade: "Frota",
      entidadeId: id,
      acao: "ATUALIZACAO",
      antes: frotaAntes,
      depois: frotaAtualizada,
      ator,
      filialId,
    })

    return frotaAtualizada
  })
}

export async function deletarFrotaService(filialId: number, id: number, ator: Ator | null) {
  const frotaAntes = await prisma.frota.findUniqueOrThrow({ where: { id, filialId } })

  return prisma.$transaction(async (tx) => {
    const frotaDeletada = await tx.frota.update({
      where: { id, filialId },
      data: { deletadoEm: new Date() },
    })

    await registrarAuditoria(tx, {
      entidade: "Frota",
      entidadeId: id,
      acao: "EXCLUSAO",
      antes: frotaAntes,
      depois: frotaDeletada,
      ator,
      filialId,
    })

    return frotaDeletada
  })
}
