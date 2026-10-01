import type { Prisma } from "@prisma/client"
import { filtroViagemAtiva, SELECT_VIAGEM_AGENDA } from "@/lib/queries/motoristas"
import { inicioDoDia } from "@/lib/utils/date-format"
import { completarHistoricoComAncora, filtroJanelaJornada, inicioJanelaJornada } from "@/lib/queries/jornada-historico"
import { calcularAvisoDescanso, viagemBloqueiaAgenda, viagemDesmentidaPeloRelatorio } from "./alocacao.service"

export const AVISO_VIAGEM_DESMENTIDA =
  "O relatório de jornada não mostra o motorista trabalhando nos dias desta viagem — ela não conta pro descanso. Confira se aconteceu e cancele ou corrija."
import { prepararJornadaDoMotorista } from "./jornada.service"

/**
 * Recalcula e grava o aviso de descanso (`avisoInterjornada`) de todas as
 * viagens ainda em aberto em que esses motoristas são o principal — com a
 * regra única de calcularAvisoDescanso (relatório + viagens, finalizada
 * contando a partir da finalização, 11h ou 35h).
 *
 * Chamado dentro da transação de toda gravação que pode mudar o descanso de
 * alguém: criar/editar/alocar/excluir viagem, mudar status (finalizar libera
 * o motorista) e importar o Relatório de Jornada. Antes o aviso era calculado
 * só pra viagem sendo salva e ficava "congelado": finalizar a viagem anterior
 * ou importar um relatório novo não o atualizava.
 *
 * Viagens FINALIZADA/CANCELADA ficam de fora: o aviso delas é histórico (o
 * que valia quando ainda estavam em aberto) e alimenta os indicadores de
 * Relatórios. Só grava o que mudou.
 */
export async function recalcularAvisosInterjornada(
  tx: Prisma.TransactionClient,
  filialId: number,
  motoristaIds: Array<number | null | undefined>,
  agora: Date = new Date(),
) {
  const ids = [...new Set(motoristaIds.filter((id): id is number => typeof id === "number"))]
  if (ids.length === 0) {
    return
  }

  const filtroViagem = filtroViagemAtiva(agora)
  // Histórico só da janela recente + âncora (ver jornada-historico.ts) —
  // isto roda dentro de TODA gravação de viagem.
  const desde = inicioJanelaJornada(agora)
  const motoristasBrutos = await tx.motorista.findMany({
    where: { id: { in: ids }, filialId },
    select: {
      id: true,
      diasTrabalhados: true,
      filial: { select: { relatorioJornadaAte: true } },
      registrosJornada: {
        where: filtroJanelaJornada(desde),
        select: { data: true, codigo: true, fimJornada: true },
        orderBy: { data: "asc" },
      },
      viagens: {
        where: filtroViagem,
        select: { ...SELECT_VIAGEM_AGENDA, avisoInterjornada: true, avisoRelatorioJornada: true },
      },
      // Trabalho como acompanhante também conta como jornada anterior.
      viagensComoAcompanhante: { where: filtroViagem, select: SELECT_VIAGEM_AGENDA },
    },
  })

  const motoristas = await completarHistoricoComAncora(motoristasBrutos, desde, tx)
  const hoje = inicioDoDia(agora)

  for (const motorista of motoristas) {
    const agenda = {
      diasTrabalhados: motorista.diasTrabalhados,
      ...prepararJornadaDoMotorista(motorista),
      viagens: [...motorista.viagens, ...motorista.viagensComoAcompanhante],
    }

    for (const viagem of motorista.viagens) {
      // Vale também pra finalizada: se o relatório não mostra o motorista
      // trabalhando nos dias dela, alguém precisa conferir.
      const avisoRelatorio =
        viagemBloqueiaAgenda(viagem) && viagemDesmentidaPeloRelatorio(agenda, viagem) ? AVISO_VIAGEM_DESMENTIDA : null
      if (avisoRelatorio !== (viagem.avisoRelatorioJornada ?? null)) {
        await tx.viagem.update({ where: { id: viagem.id }, data: { avisoRelatorioJornada: avisoRelatorio } })
      }

      if (viagem.status === "FINALIZADA" || viagem.status === "CANCELADA") continue

      const aviso = calcularAvisoDescanso(agenda, viagem, hoje)
      if (aviso !== viagem.avisoInterjornada) {
        await tx.viagem.update({ where: { id: viagem.id }, data: { avisoInterjornada: aviso } })
      }
    }
  }
}
