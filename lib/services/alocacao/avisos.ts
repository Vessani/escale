import { encontrarFimJornadaAnterior } from "../jornada.service"
import {
  descansoMinimoNecessarioApos,
  fimEfetivoViagem,
  MINIMO_HORAS_ENTRE_FOLGAS,
  MINIMO_HORAS_ENTRE_JORNADAS,
  viagemBloqueiaAgenda,
} from "./disponibilidade"
import type { MotoristaComAgenda } from "./tipos"

/**
 * Aviso de descanso insuficiente entre o fim do trabalho anterior e o início
 * da nova viagem: menos que `minimoHoras` — 11h de interjornada, ou 35h de
 * descanso semanal depois do 6º dia (ver descansoMinimoNecessarioApos).
 * É só aviso — não desqualifica o motorista da sugestão, sinaliza depois de
 * escolhido, pra o time negociar nível de serviço com o cliente se precisar.
 */
export function calcularAvisoInterjornada(
  fimJornadaAnterior: Date | string | null,
  inicioNovaViagem: Date,
  minimoHoras: number = MINIMO_HORAS_ENTRE_JORNADAS,
): string | null {
  if (!fimJornadaAnterior) {
    return null
  }

  const fim = new Date(fimJornadaAnterior)
  const horasDescanso = (inicioNovaViagem.getTime() - fim.getTime()) / (60 * 60 * 1000)

  if (horasDescanso >= minimoHoras) {
    return null
  }

  const horasDescansoTexto = Math.max(0, horasDescanso).toFixed(1)
  const tipoDescanso = minimoHoras >= MINIMO_HORAS_ENTRE_FOLGAS ? "Descanso semanal" : "Interjornada"
  return `${tipoDescanso}: motorista teve apenas ${horasDescansoTexto}h de descanso (mínimo ${minimoHoras}h).`
}

type MotoristaParaAvisoDescanso = Pick<MotoristaComAgenda, "registrosJornada" | "diasTrabalhados" | "viagens">

/**
 * Quando o motorista parou de trabalhar pela última vez antes de `inicioViagem`:
 * o mais tarde entre o fim de jornada do relatório importado (dado real do
 * rastreador) e o fim efetivo das viagens dele que começaram antes — viagem
 * finalizada conta a partir da finalização (ver fimEfetivoViagem), as demais
 * pelo fim previsto. `viagemId` é a própria viagem avaliada, ignorada na
 * agenda (ausente pra uma viagem ainda não gravada).
 */
export function encontrarFimTrabalhoAnterior(
  motorista: MotoristaParaAvisoDescanso,
  inicioViagem: Date,
  viagemId?: number,
): Date | null {
  let maisRecente = encontrarFimJornadaAnterior(motorista.registrosJornada, inicioViagem)

  for (const viagem of motorista.viagens) {
    if (viagem.id === viagemId || !viagemBloqueiaAgenda(viagem)) continue
    if (new Date(viagem.inicioPrevisto) >= inicioViagem) continue

    const fim = fimEfetivoViagem(viagem)
    if (!maisRecente || fim > maisRecente) {
      maisRecente = fim
    }
  }

  return maisRecente
}

/**
 * Regra única de descanso pro aviso gravado na viagem: mesmo fim de trabalho
 * e mesmo mínimo (11h/35h) que a disponibilidade usa pra alocar (ver
 * motoristaEstaDisponivelNoPeriodo) — o aviso e a alocação não discordam.
 */
export function calcularAvisoDescanso(
  motorista: MotoristaParaAvisoDescanso,
  viagem: { id?: number; inicioPrevisto: Date | string },
  hoje: Date,
): string | null {
  const inicioViagem = new Date(viagem.inicioPrevisto)
  const fimAnterior = encontrarFimTrabalhoAnterior(motorista, inicioViagem, viagem.id)

  if (!fimAnterior) {
    return null
  }

  const minimoHoras = descansoMinimoNecessarioApos(motorista, fimAnterior, hoje)
  return calcularAvisoInterjornada(fimAnterior, inicioViagem, minimoHoras)
}
