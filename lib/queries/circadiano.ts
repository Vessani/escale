import { prisma } from "@/lib/prisma"
import { colunaDateParaLocal } from "@/lib/utils/date-format"
import {
  ocorrenciasPrevistas,
  ocorrenciasRealizadas,
  ordenarOcorrencias,
  type OcorrenciaCircadiano,
} from "@/lib/services/circadiano.service"

const UM_DIA_MS = 24 * 60 * 60 * 1000

export type RelatorioCircadiano = {
  previstas: OcorrenciaCircadiano[]
  realizadas: OcorrenciaCircadiano[]
  /** Último dia coberto pelo Relatório de Jornada importado (null = nunca importado). */
  relatorioAte: Date | null
}

/**
 * Ciclo circadiano do período [de, ate] — só motoristas que aparecem no
 * Relatório de Jornada (têm algum dia com horário real importado).
 * Realizadas: jornadas reais que começaram no período. Previstas: viagens
 * agendadas no período que o relatório ainda não cobre.
 */
export async function buscarRelatorioCircadiano(filialId: number, de: Date, ate: Date): Promise<RelatorioCircadiano> {
  const [motoristas, jornadas, viagens, filial] = await Promise.all([
    prisma.motorista.findMany({
      where: { filialId, deletadoEm: null, registrosJornada: { some: { fimJornada: { not: null } } } },
      select: { id: true, nome: true, turno: true },
    }),
    prisma.registroJornada.findMany({
      where: {
        motorista: { filialId, deletadoEm: null },
        inicioJornada: { gte: de, lte: ate },
        fimJornada: { not: null },
      },
      select: { motoristaId: true, inicioJornada: true, fimJornada: true },
    }),
    // Um dia de folga nas pontas: jornada que começa no fim do período pode
    // estar dentro de uma viagem que começou antes dele.
    prisma.viagem.findMany({
      where: {
        filialId,
        deletadoEm: null,
        status: { not: "CANCELADA" },
        inicioPrevisto: { lte: new Date(ate.getTime() + UM_DIA_MS) },
        fimPrevisto: { gte: new Date(de.getTime() - UM_DIA_MS) },
        OR: [{ motoristaId: { not: null } }, { motoristaAcompanhanteId: { not: null } }],
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
    }),
    prisma.filial.findUnique({ where: { id: filialId }, select: { relatorioJornadaAte: true } }),
  ])

  const relatorioAte = filial?.relatorioJornadaAte ? colunaDateParaLocal(filial.relatorioJornadaAte) : null
  const jornadasValidas = jornadas.flatMap((jornada) =>
    jornada.inicioJornada && jornada.fimJornada
      ? [{ motoristaId: jornada.motoristaId, inicioJornada: jornada.inicioJornada, fimJornada: jornada.fimJornada }]
      : [],
  )
  const viagensNoPeriodo = viagens.filter(
    (viagem) => viagem.inicioPrevisto >= de && viagem.inicioPrevisto <= ate,
  )

  return {
    realizadas: ordenarOcorrencias(ocorrenciasRealizadas(motoristas, jornadasValidas, viagens)),
    previstas: ordenarOcorrencias(ocorrenciasPrevistas(motoristas, viagensNoPeriodo, relatorioAte), "proximas"),
    relatorioAte,
  }
}
