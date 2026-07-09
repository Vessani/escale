import { StatusViagem, type Prisma } from "@prisma/client"
import { fimDoDia, inicioDoDia } from "@/lib/utils/date-format"
import { registrarJornadaNoDia } from "./motorista.service"

const STATUS_NAO_ATIVOS: StatusViagem[] = ["CANCELADA", "FINALIZADA"]

export function deveMarcarMotoristaComoFolga(diasTrabalhados: number, possuiViagemAtivaHoje: boolean) {
  return diasTrabalhados >= 1 && diasTrabalhados <= 6 && !possuiViagemAtivaHoje
}

export function deveRetirarMotoristaDaFolga(diasTrabalhados: number, possuiViagemAtivaHoje: boolean) {
  return diasTrabalhados === 7 && possuiViagemAtivaHoje
}

/**
 * Reconcilia o status de folga apenas dos motoristas informados (tipicamente
 * o(s) motorista(s) envolvido(s) na viagem que acabou de ser criada/editada/
 * excluída). Não escaneia a tabela inteira — do contrário, qualquer alteração
 * numa única viagem alterava o "diasTrabalhados" de motoristas sem nenhuma
 * relação com essa viagem.
 */
export async function reconciliarFolgaMotoristasNoDiaAtual(
  tx: Prisma.TransactionClient,
  motoristaIds: Array<number | null | undefined>,
  dataReferencia = new Date(),
) {
  const idsRelevantes = [...new Set(motoristaIds.filter((id): id is number => id != null))]

  if (idsRelevantes.length === 0) {
    return
  }

  const inicioHoje = inicioDoDia(dataReferencia)
  const fimHoje = fimDoDia(dataReferencia)
  const viagensAtivasHoje = {
    none: {
      deletadoEm: null,
      status: { notIn: STATUS_NAO_ATIVOS },
      inicioPrevisto: { lte: fimHoje },
      fimPrevisto: { gte: inicioHoje },
    },
  }
  const viagensComAtividadeHoje = {
    some: {
      deletadoEm: null,
      status: { notIn: STATUS_NAO_ATIVOS },
      inicioPrevisto: { lte: fimHoje },
      fimPrevisto: { gte: inicioHoje },
    },
  }

  const paraFolga = await tx.motorista.findMany({
    where: {
      id: { in: idsRelevantes },
      deletadoEm: null,
      diasTrabalhados: { gte: 1, lte: 6 },
      viagens: viagensAtivasHoje,
    },
    select: { id: true },
  })

  for (const motorista of paraFolga) {
    await registrarJornadaNoDia(tx, motorista.id, dataReferencia, 7)
  }

  const saindoDaFolga = await tx.motorista.findMany({
    where: {
      id: { in: idsRelevantes },
      deletadoEm: null,
      diasTrabalhados: 7,
      viagens: viagensComAtividadeHoje,
    },
    select: { id: true },
  })

  for (const motorista of saindoDaFolga) {
    await registrarJornadaNoDia(tx, motorista.id, dataReferencia, 1)
  }
}
