import { prisma } from "@/lib/prisma"
import { STATUS_KM_CUSTOS, type ViagemKmCustos } from "@/lib/services/relatorios/km-custos"

/** Viagens que saíram no período (pelo início previsto), com km, despesas e entregas. */
export async function buscarViagensKmCustos(filialId: number, de: Date, ate: Date, motoristaId?: number): Promise<ViagemKmCustos[]> {
  return prisma.viagem.findMany({
    where: {
      filialId,
      deletadoEm: null,
      status: { in: STATUS_KM_CUSTOS },
      inicioPrevisto: { gte: de, lte: ate },
      ...(motoristaId ? { motoristaId } : {}),
    },
    select: {
      id: true,
      numViagem: true,
      status: true,
      inicioPrevisto: true,
      horarioRealSaida: true,
      finalizadoEm: true,
      kmInicial: true,
      kmFinal: true,
      cavalo: true,
      carreta: true,
      motorista: { select: { id: true, nome: true } },
      despesas: { where: { deletadoEm: null }, select: { tipo: true, valorCentavos: true } },
      entregas: { orderBy: { id: "asc" }, select: { cidade: true, uf: true, sapcode: true, codewhite: true } },
    },
  })
}

/** Motoristas do cadastro, pro filtro do relatório. */
export async function buscarMotoristasDoFiltro(filialId: number) {
  return prisma.motorista.findMany({
    where: { filialId, deletadoEm: null },
    orderBy: { nome: "asc" },
    select: { id: true, nome: true },
  })
}

/** ?motorista= da URL: id positivo ou nada. */
export function parseMotoristaFiltro(texto: string | null | undefined): number | undefined {
  const id = Number(texto)
  return Number.isInteger(id) && id > 0 ? id : undefined
}
