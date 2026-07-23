import type { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { formatarDataHoraPtBr } from "@/lib/utils/date-format"
import { frotaEhValida } from "./frota-regras"

export { frotaEhValida } from "./frota-regras"

export type FrotaInput = {
  cavalo: string
  carreta: string
  disponivelEm?: string | Date | null
}

/**
 * Verifica se o conjunto (cavalo + carreta) cadastrado ainda não está
 * disponível no início da nova viagem. Não bloqueia a criação/edição — só
 * retorna uma mensagem de aviso (ou null), no mesmo espírito do
 * avisoInterjornada (ver alocacao.service.ts / viagem.service.ts).
 */
export async function calcularAvisoFrotaIndisponivel(
  cavalo: string,
  carreta: string,
  inicioNovo: Date,
): Promise<string | null> {
  if (!frotaEhValida(cavalo) || !frotaEhValida(carreta)) {
    return null
  }

  const frota = await prisma.frota.findUnique({
    where: { cavalo_carreta: { cavalo, carreta } },
  })

  if (!frota?.disponivelEm || frota.disponivelEm <= inicioNovo) {
    return null
  }

  return `Frota ${cavalo}/${carreta} só estará disponível a partir de ${formatarDataHoraPtBr(frota.disponivelEm)}.`
}

/**
 * Cadastra (ou atualiza) a disponibilidade do conjunto cavalo+carreta com o
 * fim previsto da viagem mais recente — a viagem mais recente pra aquela
 * dupla sempre sobrescreve o valor guardado. Se precisar corrigir manualmente
 * (viagem cancelada, liberação de manutenção), o cadastro (ver
 * criarFrotaService/editarFrotaService) permite editar o valor à mão.
 */
export async function registrarOuAtualizarDisponibilidadeFrota(
  tx: Prisma.TransactionClient,
  cavalo: string,
  carreta: string,
  fimNovo: Date,
): Promise<void> {
  if (!frotaEhValida(cavalo) || !frotaEhValida(carreta)) {
    return
  }

  await tx.frota.upsert({
    where: { cavalo_carreta: { cavalo, carreta } },
    update: { disponivelEm: fimNovo, deletadoEm: null },
    create: { cavalo, carreta, disponivelEm: fimNovo },
  })
}

/** Cria um conjunto manualmente pelo cadastro — separado do auto-registro feito ao criar/editar viagem. */
export async function criarFrotaService(dados: FrotaInput) {
  const existente = await prisma.frota.findFirst({
    where: { cavalo: dados.cavalo, carreta: dados.carreta, deletadoEm: null },
  })

  if (existente) {
    throw new Error("Já existe um conjunto cadastrado com essa frota (cavalo/carreta).")
  }

  return prisma.frota.create({
    data: {
      cavalo: dados.cavalo,
      carreta: dados.carreta,
      disponivelEm: dados.disponivelEm ? new Date(dados.disponivelEm) : null,
    },
  })
}

export async function editarFrotaService(id: number, dados: FrotaInput) {
  const existente = await prisma.frota.findFirst({
    where: { cavalo: dados.cavalo, carreta: dados.carreta, deletadoEm: null, id: { not: id } },
  })

  if (existente) {
    throw new Error("Já existe um conjunto cadastrado com essa frota (cavalo/carreta).")
  }

  return prisma.frota.update({
    where: { id },
    data: {
      cavalo: dados.cavalo,
      carreta: dados.carreta,
      disponivelEm: dados.disponivelEm ? new Date(dados.disponivelEm) : null,
    },
  })
}

export async function deletarFrotaService(id: number) {
  return prisma.frota.update({
    where: { id },
    data: { deletadoEm: new Date() },
  })
}
