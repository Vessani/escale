import { prisma } from "@/lib/prisma"
import type { JornadaReal, MotoristaJornada } from "@/lib/services/relatorios/jornada-analise"
import type { ViagemCircadiano } from "@/lib/services/circadiano.service"

const UM_DIA_MS = 24 * 60 * 60 * 1000

/** Dias antes do período carregados a mais: o descanso da 1ª jornada do período depende da última antes dele. */
const DIAS_ANTES_PARA_DESCANSO = 3

export type DadosJornada = {
  motoristas: MotoristaJornada[]
  jornadas: JornadaReal[]
  viagens: ViagemCircadiano[]
}

/**
 * Motoristas ativos da filial, as jornadas reais (com horário vindo do
 * Relatório de Jornada) do período — mais alguns dias antes, pro cálculo de
 * descanso — e as viagens do Escale nesse intervalo, pra dizer o que cada
 * jornada estava fazendo.
 */
export async function carregarDadosJornada(filialId: number, de: Date, ate: Date): Promise<DadosJornada> {
  const desde = new Date(de.getTime() - DIAS_ANTES_PARA_DESCANSO * UM_DIA_MS)

  const [motoristas, registros, viagens] = await Promise.all([
    prisma.motorista.findMany({
      where: { filialId, deletadoEm: null },
      select: { id: true, nome: true, turno: true, tipo: true },
      orderBy: { nome: "asc" },
    }),
    prisma.registroJornada.findMany({
      where: {
        motorista: { filialId, deletadoEm: null },
        inicioJornada: { gte: desde, lte: ate },
        fimJornada: { not: null },
      },
      select: { motoristaId: true, inicioJornada: true, fimJornada: true, codigo: true, diasSemFolga: true },
    }),
    prisma.viagem.findMany({
      where: {
        filialId,
        deletadoEm: null,
        status: { not: "CANCELADA" },
        inicioPrevisto: { lte: new Date(ate.getTime() + UM_DIA_MS) },
        fimPrevisto: { gte: desde },
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
  ])

  const jornadas = registros.flatMap((registro) =>
    registro.inicioJornada && registro.fimJornada
      ? [
          {
            motoristaId: registro.motoristaId,
            inicioJornada: registro.inicioJornada,
            fimJornada: registro.fimJornada,
            codigo: registro.codigo,
            diasSemFolga: registro.diasSemFolga,
          },
        ]
      : [],
  )

  return { motoristas, jornadas, viagens }
}
