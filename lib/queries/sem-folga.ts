import type { Turno } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { colunaDateParaLocal } from "@/lib/utils/date-format"
import { MAX_DIAS_SEM_FOLGA } from "@/lib/services/dias-sem-folga"
import { viagemDaJornada } from "@/lib/services/circadiano.service"

const UM_DIA_MS = 24 * 60 * 60 * 1000

type FolgaEstourada = {
  motoristaId: number
  motorista: string
  turno: Turno
  dia: Date
  diasSemFolga: number
  inicio: Date | null
  fim: Date | null
  atividade: "VIAGEM" | "INTERNO"
  numViagem: string | null
  cavalo: string | null
  carreta: string | null
}

/**
 * Dias do relatório de jornada em que o motorista já estava no 7º dia (ou
 * mais) seguido sem folga, no período [de, ate] — mais recentes primeiro,
 * com a viagem do Escale que ele fazia naquele horário.
 */
export async function buscarFolgasEstouradas(filialId: number, de: Date, ate: Date): Promise<FolgaEstourada[]> {
  const registros = await prisma.registroJornada.findMany({
    where: {
      motorista: { filialId, deletadoEm: null },
      diasSemFolga: { gt: MAX_DIAS_SEM_FOLGA },
      // Coluna @db.Date: compara com o dia em UTC (uma folga de 1 dia nas pontas e o filtro abaixo resolve o resto).
      data: { gte: new Date(de.getTime() - UM_DIA_MS), lte: new Date(ate.getTime() + UM_DIA_MS) },
    },
    orderBy: [{ data: "desc" }],
    select: {
      data: true,
      diasSemFolga: true,
      inicioJornada: true,
      fimJornada: true,
      motorista: { select: { id: true, nome: true, turno: true } },
    },
  })

  const noPeriodo = registros
    .map((registro) => ({ ...registro, dia: colunaDateParaLocal(registro.data) }))
    .filter((registro) => registro.dia >= de && registro.dia <= ate)
  if (noPeriodo.length === 0) return []

  const viagens = await prisma.viagem.findMany({
    where: {
      filialId,
      deletadoEm: null,
      status: { not: "CANCELADA" },
      inicioPrevisto: { lte: new Date(ate.getTime() + 2 * UM_DIA_MS) },
      fimPrevisto: { gte: new Date(de.getTime() - UM_DIA_MS) },
      OR: [
        { motoristaId: { in: noPeriodo.map((registro) => registro.motorista.id) } },
        { motoristaAcompanhanteId: { in: noPeriodo.map((registro) => registro.motorista.id) } },
      ],
    },
    select: {
      id: true,
      numViagem: true,
      cavalo: true,
      carreta: true,
      status: true,
      inicioPrevisto: true,
      fimPrevisto: true,
      finalizadoEm: true,
      motoristaId: true,
      motoristaAcompanhanteId: true,
    },
  })

  return noPeriodo.map((registro) => {
    const viagem =
      registro.inicioJornada && registro.fimJornada
        ? viagemDaJornada(viagens, registro.motorista.id, registro.inicioJornada, registro.fimJornada)
        : null
    return {
      motoristaId: registro.motorista.id,
      motorista: registro.motorista.nome,
      turno: registro.motorista.turno,
      dia: registro.dia,
      diasSemFolga: registro.diasSemFolga ?? 0,
      inicio: registro.inicioJornada,
      fim: registro.fimJornada,
      atividade: viagem ? "VIAGEM" : "INTERNO",
      numViagem: viagem?.numViagem ?? null,
      cavalo: viagem?.cavalo ?? null,
      carreta: viagem?.carreta ?? null,
    }
  })
}
