import type { MotoristaCompativel } from "@/lib/types/alocacao"
import { formatarHoraLocal } from "@/lib/utils/date-format"
import { calcularAvisoDescanso, calcularDescansoAntesDaViagem, calcularDiasDisponiveis, type MotoristaComAgenda } from "./alocacao.service"
import { projetarCodigoNoDia } from "./jornada.service"

/**
 * Como cada motorista compatível aparece na escolha da alocação (tela de
 * Alocação e revisão do import): dias disponíveis no dia da viagem, a partir
 * de quando o descanso está cumprido e o aviso de descanso que ELE geraria —
 * calculado pra todos, não só pro sugerido, pra que trocar o motorista troque
 * também o aviso na tela.
 */
export function montarMotoristaCompativel(
  motorista: MotoristaComAgenda,
  viagem: { id?: number; inicioPrevisto: Date },
  hoje: Date,
): MotoristaCompativel {
  const codigoNaViagem = projetarCodigoNoDia(motorista.registrosJornada, viagem.inicioPrevisto, hoje, motorista.diasTrabalhados)
  const liberadoEm = calcularDescansoAntesDaViagem(motorista, viagem.inicioPrevisto, hoje, viagem.id)?.inicioPermitido ?? null

  return {
    id: motorista.id,
    nome: motorista.nome,
    tipo: motorista.tipo,
    diasTrabalhados: codigoNaViagem,
    diasDisponiveis: calcularDiasDisponiveis(codigoNaViagem),
    turno: motorista.turno,
    horarioHabitual: motorista.jornadaRelatorioInicio ? formatarHoraLocal(motorista.jornadaRelatorioInicio) : null,
    proximoInicioDisponivel: liberadoEm ? formatarHoraLocal(liberadoEm) : null,
    liberadoEm: liberadoEm ? liberadoEm.toISOString() : null,
    avisoDescanso: calcularAvisoDescanso(motorista, viagem, hoje),
  }
}
