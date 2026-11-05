import type { Prisma } from "@prisma/client"
import { filtroJanelaJornada, completarHistoricoComAncora, inicioJanelaJornada } from "@/lib/queries/jornada-historico"
import { filtroAtividadeNoDia } from "@/lib/queries/motoristas"
import { fimDoDia, inicioDoDia } from "@/lib/utils/date-format"
import { CODIGO_FOLGA } from "./codigo-jornada"
import { codigoTrabalhandoNoDia, prepararJornadaDoMotorista, situacaoDoDia } from "./jornada.service"
import { registrarJornadaNoDia } from "./motorista.service"

export function deveRetirarMotoristaDaFolga(diasTrabalhados: number, possuiViagemAtivaHoje: boolean) {
  return diasTrabalhados === CODIGO_FOLGA && possuiViagemAtivaHoje
}

/**
 * Tira da Folga os motoristas informados (tipicamente os envolvidos na viagem
 * que acabou de ser criada/editada/excluída) que têm trabalho hoje. Não
 * escaneia a tabela inteira — do contrário, qualquer alteração numa única
 * viagem alterava o "diasTrabalhados" de motoristas sem nenhuma relação com
 * essa viagem.
 *
 * NUNCA marca Folga: "sem viagem hoje" não prova folga (pode ser interno, troca
 * de escala, viagem cancelada). Folga vem do Relatório de Jornada ou de quem
 * escala, pelo calendário ou pela sugestão da tela de motoristas sem viagem.
 *
 * `janelasRelevantes` é a janela (ou janelas, se a data mudou numa edição —
 * passe a de antes e a de depois) da viagem que disparou essa chamada. Se
 * nenhuma delas tocar "hoje", a função não faz nada.
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

  const algumaJanelaTocaHoje = janelasRelevantes.some((janela) => janela.inicioPrevisto <= fimHoje && janela.fimPrevisto >= inicioHoje)
  if (!algumaJanelaTocaHoje) {
    return
  }

  // Decide pelo código projetado pra hoje, não pelo cache diasTrabalhados:
  // ele só muda quando algo grava no dia de hoje, então podia estar parado num
  // 7 antigo e zerar o ciclo de quem estava no meio dele.
  const atividadeHoje = filtroAtividadeNoDia(dataReferencia)
  const desde = inicioJanelaJornada(dataReferencia)
  const motoristasBrutos = await tx.motorista.findMany({
    where: { id: { in: idsRelevantes }, deletadoEm: null },
    select: {
      id: true,
      diasTrabalhados: true,
      filial: { select: { relatorioJornadaAte: true } },
      registrosJornada: {
        where: filtroJanelaJornada(desde),
        select: { data: true, codigo: true, fimJornada: true },
        orderBy: { data: "asc" },
      },
      // Conta como "atividade hoje" tanto como motorista principal quanto acompanhante.
      viagens: { where: atividadeHoje, select: { id: true }, take: 1 },
      viagensComoAcompanhante: { where: atividadeHoje, select: { id: true }, take: 1 },
    },
  })
  const motoristas = await completarHistoricoComAncora(motoristasBrutos, desde, tx)

  for (const motorista of motoristas) {
    const jornada = { diasTrabalhados: motorista.diasTrabalhados, ...prepararJornadaDoMotorista(motorista) }
    const { codigo: codigoHoje } = situacaoDoDia(jornada, dataReferencia, dataReferencia)
    const temAtividadeHoje = motorista.viagens.length > 0 || motorista.viagensComoAcompanhante.length > 0

    if (deveRetirarMotoristaDaFolga(codigoHoje, temAtividadeHoje)) {
      await registrarJornadaNoDia(tx, motorista.id, dataReferencia, codigoTrabalhandoNoDia(jornada, dataReferencia, dataReferencia))
    }
  }
}
