import { prisma } from "@/lib/prisma"
import { colunaDateParaLocal } from "@/lib/utils/date-format"
import { MAX_DIAS_SEM_FOLGA } from "@/lib/services/dias-sem-folga"
import { viagemDaJornada } from "@/lib/services/circadiano.service"
import {
  folgasSemanaisCurtas,
  juntarEstourosSetimoDia,
  type EstouroSetimoDia,
  type SetimoDiaTrabalhado,
} from "@/lib/services/relatorios/jornada-analise"
import { carregarDadosJornada } from "@/lib/queries/relatorios/jornada"

const UM_DIA_MS = 24 * 60 * 60 * 1000

/**
 * Dias do relatório de jornada em que o motorista já estava no 7º dia (ou
 * mais) seguido sem folga, no período [de, ate] — mais recentes primeiro,
 * com a viagem do Escale que ele fazia naquele horário.
 */
async function buscarSetimosDiasTrabalhados(filialId: number, de: Date, ate: Date): Promise<SetimoDiaTrabalhado[]> {
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
      atividade: viagem ? ("VIAGEM" as const) : ("INTERNO" as const),
      numViagem: viagem?.numViagem ?? null,
      cavalo: viagem?.cavalo ?? null,
      carreta: viagem?.carreta ?? null,
    }
  })
}

/**
 * Estouro de 7º dia no período: dias em que o motorista trabalhou o 7º dia
 * seguido (ou mais) e folgas depois do 6º dia menores que 35h.
 */
export async function buscarEstourosSetimoDia(filialId: number, de: Date, ate: Date): Promise<EstouroSetimoDia[]> {
  const [setimos, dados] = await Promise.all([buscarSetimosDiasTrabalhados(filialId, de, ate), carregarDadosJornada(filialId, de, ate)])
  return juntarEstourosSetimoDia(setimos, folgasSemanaisCurtas(dados.motoristas, dados.jornadas, dados.viagens, de, ate))
}
