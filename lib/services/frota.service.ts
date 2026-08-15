import type { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { formatarDataHoraPtBr } from "@/lib/utils/date-format"
import { frotaEhValida } from "./frota-regras"

export { frotaEhValida } from "./frota-regras"

export type FrotaInput = {
  cavalo: string
  carreta: string
  disponivelEm?: string | Date | null
  emManutencao?: boolean
}

/**
 * Verifica se o conjunto (cavalo + carreta) cadastrado ainda não está
 * disponível no início da nova viagem — seja porque está marcado como em
 * manutenção (manual), seja porque uma viagem anterior só libera depois.
 * Não bloqueia a criação/edição — só retorna uma mensagem de aviso (ou
 * null), no mesmo espírito do avisoInterjornada (ver alocacao.service.ts /
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
    where: { cavalo, carreta, filialId, deletadoEm: null },
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
 * Recalcula a disponibilidade de um conjunto cavalo+carreta a partir de
 * TODAS as viagens ativas dele na filial (nem CANCELADA nem FINALIZADA, sem
 * soft delete) — disponivelEm vira o maior fimPrevisto entre elas, ou null
 * se não sobrar nenhuma (frota livre agora).
 *
 * Substitui a versão antiga, que só "carimbava" o fim da viagem que acabou
 * de ser criada/editada — sem recalcular, cancelar ou finalizar uma viagem
 * nunca liberava a frota (ela ficava presa no fim previsto original pra
 * sempre), e editar uma viagem trocando de cavalo/carreta também não
 * liberava o conjunto antigo. Por isso precisa ser chamado sempre que uma
 * viagem que usa essa frota muda de estado: criada, editada (nas duas duplas,
 * se cavalo/carreta mudou), teve o status alterado, ou foi excluída.
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

  const viagemAtiva = await tx.viagem.findFirst({
    where: {
      cavalo,
      carreta,
      filialId,
      deletadoEm: null,
      status: { notIn: ["CANCELADA", "FINALIZADA"] },
    },
    orderBy: { fimPrevisto: "desc" },
    select: { fimPrevisto: true },
  })

  const disponivelEm = viagemAtiva?.fimPrevisto ?? null

  // Sem @@unique em (cavalo, carreta) no schema (ver comentário no model
  // Frota) — não dá pra usar upsert pela dupla, então busca a ativa e
  // decide entre update/create à mão.
  const existente = await tx.frota.findFirst({
    where: { cavalo, carreta, filialId, deletadoEm: null },
  })

  if (existente) {
    await tx.frota.update({
      where: { id: existente.id, filialId },
      data: { disponivelEm },
    })
    return
  }

  // Sem conjunto cadastrado e sem viagem ativa: nada a guardar.
  if (disponivelEm) {
    await tx.frota.create({
      data: { cavalo, carreta, disponivelEm, filialId },
    })
  }
}

/** Cria um conjunto manualmente pelo cadastro — separado do auto-registro feito ao criar/editar viagem. */
export async function criarFrotaService(filialId: number, dados: FrotaInput) {
  const existente = await prisma.frota.findFirst({
    where: { cavalo: dados.cavalo, carreta: dados.carreta, filialId, deletadoEm: null },
  })

  if (existente) {
    throw new Error("Já existe um conjunto cadastrado com essa frota (cavalo/carreta).")
  }

  return prisma.frota.create({
    data: {
      cavalo: dados.cavalo,
      carreta: dados.carreta,
      disponivelEm: dados.disponivelEm ? new Date(dados.disponivelEm) : null,
      emManutencao: dados.emManutencao ?? false,
      filialId,
    },
  })
}

export async function editarFrotaService(filialId: number, id: number, dados: FrotaInput) {
  const existente = await prisma.frota.findFirst({
    where: { cavalo: dados.cavalo, carreta: dados.carreta, filialId, deletadoEm: null, id: { not: id } },
  })

  if (existente) {
    throw new Error("Já existe um conjunto cadastrado com essa frota (cavalo/carreta).")
  }

  return prisma.frota.update({
    where: { id, filialId },
    data: {
      cavalo: dados.cavalo,
      carreta: dados.carreta,
      disponivelEm: dados.disponivelEm ? new Date(dados.disponivelEm) : null,
      emManutencao: dados.emManutencao ?? false,
    },
  })
}

export async function deletarFrotaService(filialId: number, id: number) {
  return prisma.frota.update({
    where: { id, filialId },
    data: { deletadoEm: new Date() },
  })
}
