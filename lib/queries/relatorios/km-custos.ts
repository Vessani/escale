import { prisma } from "@/lib/prisma"
import type { StatusViagem } from "@prisma/client"
import { STATUS_KM_CUSTOS, type ViagemKmCustos } from "@/lib/services/relatorios/km-custos"

/**
 * Viagens do período (pelo início previsto), com km, despesas e entregas.
 * Por padrão só as que saíram (Km e custos); o relatório de Viagens passa
 * todos os status menos cancelada.
 */
export async function buscarViagensKmCustos(
  filialId: number,
  de: Date,
  ate: Date,
  motoristaId?: number,
  status: StatusViagem[] = STATUS_KM_CUSTOS,
): Promise<ViagemKmCustos[]> {
  return prisma.viagem.findMany({
    where: {
      filialId,
      deletadoEm: null,
      status: { in: status },
      inicioPrevisto: { gte: de, lte: ate },
      // Com troca de motorista, a viagem aparece pra quem esteve nela em
      // qualquer trecho — não só pra quem estava com ela no fim.
      ...(motoristaId
        ? { OR: [{ motoristaId }, { trocas: { some: { OR: [{ motoristaAnteriorId: motoristaId }, { motoristaNovoId: motoristaId }] } } }] }
        : {}),
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
      produto: true,
      motorista: { select: { id: true, nome: true } },
      _count: { select: { trocas: true } },
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
