import { prisma } from "@/lib/prisma"
import { colunaDateParaLocal } from "@/lib/utils/date-format"

export async function buscarFiliais() {
  return await prisma.filial.findMany({ orderBy: { nome: "asc" } })
}

/** Nome da filial, pro cabeçalho das planilhas. */
export async function buscarNomeFilial(filialId: number): Promise<string | null> {
  const filial = await prisma.filial.findUnique({ where: { id: filialId }, select: { nome: true } })
  return filial?.nome ?? null
}

/** Até que dia o Relatório de Jornada importado cobre (ver completarFolgasDoRelatorio). */
export async function buscarCoberturaRelatorioJornada(filialId: number): Promise<Date | null> {
  const filial = await prisma.filial.findUnique({ where: { id: filialId }, select: { relatorioJornadaAte: true } })
  return filial?.relatorioJornadaAte ? colunaDateParaLocal(filial.relatorioJornadaAte) : null
}
