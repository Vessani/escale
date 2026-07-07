import { StatusViagem, type Prisma } from "@prisma/client"
import { fimDoDia, inicioDoDia } from "@/lib/utils/date-format"

const STATUS_NAO_ATIVOS: StatusViagem[] = ["CANCELADA", "FINALIZADA"]

export function deveMarcarMotoristaComoFolga(diasTrabalhados: number, possuiViagemAtivaHoje: boolean) {
  return diasTrabalhados >= 1 && diasTrabalhados <= 6 && !possuiViagemAtivaHoje
}

export function deveRetirarMotoristaDaFolga(diasTrabalhados: number, possuiViagemAtivaHoje: boolean) {
  return diasTrabalhados === 7 && possuiViagemAtivaHoje
}

export async function reconciliarFolgaMotoristasNoDiaAtual(
  tx: Prisma.TransactionClient,
  dataReferencia = new Date(),
) {
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

  await tx.motorista.updateMany({
    where: {
      deletadoEm: null,
      diasTrabalhados: { gte: 1, lte: 6 },
      viagens: viagensAtivasHoje,
    },
    data: { diasTrabalhados: 7 },
  })

  await tx.motorista.updateMany({
    where: {
      deletadoEm: null,
      diasTrabalhados: 7,
      viagens: viagensComAtividadeHoje,
    },
    data: { diasTrabalhados: 1 },
  })
}
