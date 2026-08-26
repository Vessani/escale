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
 *
 * `janelasRelevantes` é a janela (ou janelas, se a data mudou numa edição —
 * passe a de antes e a de depois) da viagem que disparou essa chamada. Se
 * nenhuma delas tocar "hoje", a função não faz nada: sem essa checagem,
 * criar/editar uma viagem pra uma data futura (comum em planejamento
 * antecipado, ver bug encontrado numa simulação de 30 dias) marcava o
 * motorista como "de folga hoje" só por não ter nenhuma viagem cobrindo o
 * dia de hoje especificamente — mesmo que ele estivesse no meio de um ciclo
 * de trabalho normal, sem nenhuma relação real com a viagem tocada.
 *
 * Sem RegistroAuditoria própria de propósito: é um efeito colateral
 * automático de uma escrita de Viagem, não uma decisão de alguém — a viagem
 * que disparou essa reconciliação já tem sua própria auditoria.
 */
export async function reconciliarFolgaMotoristasNoDiaAtual(
  tx: Prisma.TransactionClient,
  motoristaIds: Array<number | null | undefined>,
  janelasRelevantes: Array<{ inicioPrevisto: Date; fimPrevisto: Date }>,
  dataReferencia = new Date(),
) {
  const idsRelevantes = [...new Set(motoristaIds.filter((id): id is number => id != null))]

  if (idsRelevantes.length === 0) {
    return
  }

  const inicioHoje = inicioDoDia(dataReferencia)
  const fimHoje = fimDoDia(dataReferencia)

  const algumaJanelaTocaHoje = janelasRelevantes.some(
    (janela) => janela.inicioPrevisto <= fimHoje && janela.fimPrevisto >= inicioHoje,
  )
  if (!algumaJanelaTocaHoje) {
    return
  }

  const filtroAtividadeHoje = {
    deletadoEm: null,
    status: { notIn: STATUS_NAO_ATIVOS },
    inicioPrevisto: { lte: fimHoje },
    fimPrevisto: { gte: inicioHoje },
  }
  // Conta como "atividade hoje" tanto como motorista principal quanto acompanhante.
  const semAtividadeHoje = {
    AND: [
      { viagens: { none: filtroAtividadeHoje } },
      { viagensComoAcompanhante: { none: filtroAtividadeHoje } },
    ],
  }
  const comAtividadeHoje = {
    OR: [
      { viagens: { some: filtroAtividadeHoje } },
      { viagensComoAcompanhante: { some: filtroAtividadeHoje } },
    ],
  }

  const paraFolga = await tx.motorista.findMany({
    where: {
      id: { in: idsRelevantes },
      deletadoEm: null,
      diasTrabalhados: { gte: 1, lte: 6 },
      ...semAtividadeHoje,
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
      ...comAtividadeHoje,
    },
    select: { id: true },
  })

  for (const motorista of saindoDaFolga) {
    await registrarJornadaNoDia(tx, motorista.id, dataReferencia, 1)
  }
}
