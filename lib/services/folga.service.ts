import type { Prisma } from "@prisma/client"
import { filtroJanelaJornada, completarHistoricoComAncora, inicioJanelaJornada } from "@/lib/queries/jornada-historico"
import { filtroAtividadeNoDia } from "@/lib/queries/motoristas"
import { fimDoDia, inicioDoDia } from "@/lib/utils/date-format"
import { codigoConhecidoNoDia, prepararJornadaDoMotorista, projetarCodigoNoDia, type PontoRegistroJornada } from "./jornada.service"
import { registrarJornadaNoDia } from "./motorista.service"

const UM_DIA_MS = 24 * 60 * 60 * 1000
const ULTIMO_DIA_DO_CICLO = 6

/**
 * Código de quem trabalha num dia marcado como Folga. Só descansou de verdade
 * quem vinha de uma folga: aí recomeça no 1º dia. Vindo de um dia de trabalho
 * o ciclo continua — zerar esconderia o 7º dia seguido, por isso o teto de 6,
 * como no import do relatório (ver calcularCodigoDoDiasSemFolga).
 */
function codigoAoSairDaFolga(registros: PontoRegistroJornada[], dia: Date, hoje: Date, codigoAtual: number) {
  const ontem = codigoConhecidoNoDia(registros, new Date(dia.getTime() - UM_DIA_MS), hoje, codigoAtual)
  return ontem !== null && ontem >= 1 && ontem <= ULTIMO_DIA_DO_CICLO ? Math.min(ontem + 1, ULTIMO_DIA_DO_CICLO) : 1
}

export function deveRetirarMotoristaDaFolga(diasTrabalhados: number, possuiViagemAtivaHoje: boolean) {
  return diasTrabalhados === 7 && possuiViagemAtivaHoje
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
    const { registrosJornada } = prepararJornadaDoMotorista(motorista)
    const codigoHoje = projetarCodigoNoDia(registrosJornada, dataReferencia, dataReferencia, motorista.diasTrabalhados)
    const temAtividadeHoje = motorista.viagens.length > 0 || motorista.viagensComoAcompanhante.length > 0

    if (deveRetirarMotoristaDaFolga(codigoHoje, temAtividadeHoje)) {
      const codigo = codigoAoSairDaFolga(registrosJornada, dataReferencia, dataReferencia, motorista.diasTrabalhados)
      await registrarJornadaNoDia(tx, motorista.id, dataReferencia, codigo)
    }
  }
}
