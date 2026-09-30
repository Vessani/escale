import { calcularDescansoAntesDaViagem, type MotoristaParaDescanso } from "./descanso"
import { MINIMO_HORAS_ENTRE_FOLGAS, MINIMO_HORAS_ENTRE_JORNADAS } from "./disponibilidade"

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

/**
 * Aviso de descanso gravado na viagem — mesma regra única que ordena a
 * sugestão e mostra o "libera às" na tela (ver calcularDescansoAntesDaViagem):
 * o motorista sugerido em primeiro lugar nunca ganha este aviso por causa de
 * um critério diferente.
 */
export function calcularAvisoDescanso(
  motorista: MotoristaParaDescanso,
  viagem: { id?: number; inicioPrevisto: Date | string },
  hoje: Date,
): string | null {
  const inicioViagem = new Date(viagem.inicioPrevisto)
  const descanso = calcularDescansoAntesDaViagem(motorista, inicioViagem, hoje, viagem.id)

  if (!descanso) {
    return null
  }

  return calcularAvisoInterjornada(descanso.fimTrabalhoAnterior, inicioViagem, descanso.minimoHoras)
}
