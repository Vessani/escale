import type { Prisma, TipoProduto } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { converterEntradaDeDataHora, formatarDataHoraPtBr } from "@/lib/utils/date-format"
import { formatarProduto } from "./produto.service"
import { frotaEhValida } from "./frota-regras"
import { registrarAuditoria, type Ator } from "./auditoria.service"
import { FrotaDuplicadaError } from "@/lib/errors"

export { frotaEhValida } from "./frota-regras"

export type FrotaInput = {
  cavalo: string
  carreta: string
  disponivelEm?: string | Date | null
  emManutencao?: boolean
  tipoProduto?: TipoProduto | null
}

/**
 * Verifica se a frota cadastrada pra essa carreta ainda não está disponível
 * no início da nova viagem — seja porque está marcada como em manutenção
 * (manual), seja porque uma viagem anterior só libera depois. Consulta só
 * pela carreta (o cliente não liga pra qual cavalo está puxando, e corrigir
 * cavalo digitado errado viagem por viagem é trabalho demais) — o cadastro
 * em si continua sendo a dupla cavalo+carreta (ver criarFrotaService). Se
 * houver mais de um conjunto ativo cadastrado pra mesma carreta (cavalo
 * diferente), usa o mais recentemente atualizado. Não bloqueia a
 * criação/edição — só retorna uma mensagem de aviso (ou null), no mesmo
 * espírito do avisoInterjornada (ver alocacao.service.ts /
 * viagem.service.ts).
 */
export async function calcularAvisoFrotaIndisponivel(
  filialId: number,
  cavalo: string,
  carreta: string,
  inicioNovo: Date,
): Promise<string | null> {
  if (!frotaEhValida(cavalo) || !frotaEhValida(carreta)) {
    return null
  }

  const frota = await prisma.frota.findFirst({
    where: { carreta, filialId, deletadoEm: null },
    orderBy: { atualizadoEm: "desc" },
  })

  if (!frota) {
    return null
  }

  if (frota.emManutencao) {
    return `Frota ${cavalo}/${carreta} está marcada como em manutenção.`
  }

  if (!frota.disponivelEm || frota.disponivelEm <= inicioNovo) {
    return null
  }

  return `Frota ${cavalo}/${carreta} só estará disponível a partir de ${formatarDataHoraPtBr(frota.disponivelEm)}.`
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
  if (!frotaEhValida(cavalo) || !frotaEhValida(carreta)) {
    return
  }

  const existente = await tx.frota.findFirst({
    where: { carreta, filialId, deletadoEm: null },
    orderBy: { atualizadoEm: "desc" },
  })

  // Conjunto não cadastrado: nada a sincronizar (ver comentário acima).
  if (!existente) {
    return
  }

  const viagemAtiva = await tx.viagem.findFirst({
    where: {
      carreta,
      filialId,
      deletadoEm: null,
      status: { notIn: ["CANCELADA", "FINALIZADA"] },
    },
    orderBy: { fimPrevisto: "desc" },
    select: { fimPrevisto: true },
  })

  await tx.frota.update({
    where: { id: existente.id, filialId },
    data: { disponivelEm: viagemAtiva?.fimPrevisto ?? null },
  })
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
        emManutencao: dados.emManutencao ?? false,
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
        emManutencao: dados.emManutencao ?? false,
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
