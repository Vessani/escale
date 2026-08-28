import { projetarCodigoNoDia } from "../jornada.service"
import { MAX_DIAS_CONSECUTIVOS } from "./compatibilidade"
import type { MotoristaComAgenda, MotoristaParaAlocacao, ViagemParaDisponibilidade } from "./tipos"

export const MINIMO_HORAS_ENTRE_JORNADAS = 11
export const MINIMO_HORAS_ENTRE_FOLGAS = 35

export function periodoConflita(inicioA: Date, fimA: Date, inicioB: Date, fimB: Date) {
  return inicioA < fimB && fimA > inicioB
}

/**
 * CANCELADA nunca conta (a viagem não aconteceu, não há descanso a cumprir
 * por causa dela). FINALIZADA conta como qualquer viagem ativa — uma viagem
 * já concluída ainda define quando o motorista pode iniciar a próxima (ver
 * MINIMO_HORAS_ENTRE_JORNADAS/MINIMO_HORAS_ENTRE_FOLGAS); a consulta que
 * carrega `motorista.viagens` (lib/queries/motoristas.ts) já limita
 * viagens FINALIZADA às recentes, então esta função não precisa repetir esse
 * corte por tempo.
 */
function viagemBloqueiaAgenda(viagem: ViagemParaDisponibilidade) {
  if (viagem.deletadoEm) {
    return false
  }

  return viagem.status !== "CANCELADA"
}

/**
 * Duas viagens conflitam por descanso se elas se sobrepõem no tempo, ou se o
 * intervalo entre o fim de uma e o início da outra é menor que o mínimo de
 * descanso exigido (`minimoHoras`, 11h de interjornada por padrão — mesmo
 * valor de MINIMO_HORAS_ENTRE_JORNADAS/calcularAvisoInterjornada; passe
 * MINIMO_HORAS_ENTRE_FOLGAS quando a viagem anterior encerra o 6º dia
 * consecutivo do motorista, ver descansoMinimoNecessarioApos). Comparação por
 * hora exata, não por dia calendário: antes disso, uma viagem terminando
 * 23h59 "liberava" o motorista a partir de 00h01 do dia seguinte — pouco mais
 * de 2 minutos de descanso real, mesmo contando como "1 dia" de folga.
 */
export function periodosConflitamComDescanso(
  inicioA: Date,
  fimA: Date,
  inicioB: Date,
  fimB: Date,
  minimoHoras: number = MINIMO_HORAS_ENTRE_JORNADAS,
) {
  if (periodoConflita(inicioA, fimA, inicioB, fimB)) {
    return true
  }

  // Sem sobreposição real: como só se toca em um dos dois sentidos, o
  // intervalo entre elas é a diferença entre o fim da que veio antes e o
  // início da que veio depois (a ordem cronológica é confiável aqui, já que
  // periodoConflita já descartou qualquer sobreposição).
  const gapMs =
    inicioA <= inicioB ? inicioB.getTime() - fimA.getTime() : inicioA.getTime() - fimB.getTime()

  return gapMs < minimoHoras * 60 * 60 * 1000
}

/**
 * Descanso mínimo (11h ou 35h) exigido depois de uma viagem já registrada do
 * motorista, a partir do código de jornada projetado pro dia em que ela
 * termina — mesma regra de calcularProximoInicioDisponivel, aplicada aqui
 * contra a própria agenda do motorista no sistema (não só o relatório
 * importado). Sem isso, o reset da rotação (código 7 → 1 na virada pro dia
 * seguinte à Folga) somado ao mínimo de 11h deixaria passar uma viagem nova
 * horas depois da meia-noite seguinte à Folga, bem antes das 35h reais desde
 * que o motorista realmente parou de trabalhar.
 *
 * Exportada porque sugestao.ts também precisa dela ao verificar conflito
 * entre atribuições dentro do mesmo lote (ver sugerirAlocacoesEmLote).
 */
export function descansoMinimoNecessarioApos(motorista: MotoristaParaAlocacao, fimViagemExistente: Date, hoje: Date) {
  const codigoAoFim = projetarCodigoNoDia(motorista.registrosJornada, fimViagemExistente, hoje, motorista.diasTrabalhados)
  return codigoAoFim >= MAX_DIAS_CONSECUTIVOS ? MINIMO_HORAS_ENTRE_FOLGAS : MINIMO_HORAS_ENTRE_JORNADAS
}

export function motoristaEstaDisponivelNoPeriodo(
  motorista: MotoristaComAgenda,
  inicioViagem: Date,
  fimViagem: Date,
  hoje: Date,
) {
  return !motorista.viagens.some((viagem) => {
    if (!viagemBloqueiaAgenda(viagem)) {
      return false
    }

    const fimViagemExistente = new Date(viagem.fimPrevisto)
    const minimoHoras = descansoMinimoNecessarioApos(motorista, fimViagemExistente, hoje)

    return periodosConflitamComDescanso(
      new Date(viagem.inicioPrevisto),
      fimViagemExistente,
      inicioViagem,
      fimViagem,
      minimoHoras,
    )
  })
}

export function filtrarMotoristasDisponiveisNoPeriodo(
  motoristas: MotoristaComAgenda[],
  inicioViagem: Date,
  fimViagem: Date,
  hoje: Date,
) {
  return motoristas.filter((motorista) =>
    motoristaEstaDisponivelNoPeriodo(motorista, inicioViagem, fimViagem, hoje),
  )
}
