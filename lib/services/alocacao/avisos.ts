import { MINIMO_HORAS_ENTRE_JORNADAS } from "./disponibilidade"

/**
 * Aviso de interjornada: quando o descanso entre o fim da última jornada
 * conhecida do motorista (relatório) e o início da nova viagem é menor que o
 * mínimo legal (11h, o mesmo valor já configurado no cabeçalho do relatório).
 * É só aviso — não desqualifica o motorista da sugestão, sinaliza depois de
 * escolhido, pra o time negociar nível de serviço com o cliente se precisar.
 */
export function calcularAvisoInterjornada(
  fimJornadaAnterior: Date | string | null,
  inicioNovaViagem: Date,
): string | null {
  if (!fimJornadaAnterior) {
    return null
  }

  const fim = new Date(fimJornadaAnterior)
  const horasDescanso = (inicioNovaViagem.getTime() - fim.getTime()) / (60 * 60 * 1000)

  if (horasDescanso >= MINIMO_HORAS_ENTRE_JORNADAS) {
    return null
  }

  const horasDescansoTexto = Math.max(0, horasDescanso).toFixed(1)
  return `Interjornada: motorista teve apenas ${horasDescansoTexto}h de descanso (mínimo ${MINIMO_HORAS_ENTRE_JORNADAS}h).`
}
