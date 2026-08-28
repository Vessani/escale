import { encontrarFimJornadaAnterior } from "../jornada.service"
import { calcularDiasDisponiveis, codigoJornadaNaViagem, MAX_DIAS_CONSECUTIVOS, motoristaEhCompativel } from "./compatibilidade"
import { MINIMO_HORAS_ENTRE_FOLGAS, MINIMO_HORAS_ENTRE_JORNADAS } from "./disponibilidade"
import type { ContextoCompatibilidade, MotoristaParaAlocacao } from "./tipos"

const HORAS_ANTECEDENCIA_CHECKLIST = 1

/** Horário ideal de início de jornada do motorista pra uma viagem: 1h antes, pra dar tempo de checklist. */
export function calcularHorarioIdealChegada(dataInicioViagem: Date): Date {
  return new Date(dataInicioViagem.getTime() - HORAS_ANTECEDENCIA_CHECKLIST * 60 * 60 * 1000)
}

/**
 * Horário mínimo em que o motorista pode iniciar a próxima jornada, a partir
 * do fim da última jornada conhecida (relatório).
 * - Dia normal (1 a 5 dias trabalhados): fim + 11h (interjornada, art. 235-C CLT).
 * - 6º dia (último antes da folga obrigatória): fim + 35h — o descanso semanal
 *   de 35h já absorve as 11h de interjornada, não se somam.
 * Imune a fuso: soma milissegundos sobre o instante. `null` sem jornada importada.
 */
export function calcularProximoInicioDisponivel(
  fimUltimaJornada: Date | string | null,
  diasTrabalhados: number,
): Date | null {
  if (!fimUltimaJornada) {
    return null
  }

  const fim = new Date(fimUltimaJornada)
  const ehSextoDia = diasTrabalhados >= MAX_DIAS_CONSECUTIVOS
  const horasDescanso = ehSextoDia ? MINIMO_HORAS_ENTRE_FOLGAS : MINIMO_HORAS_ENTRE_JORNADAS

  return new Date(fim.getTime() + horasDescanso * 60 * 60 * 1000)
}

/**
 * Minutos entre o próximo início disponível do motorista e o horário ideal de
 * chegada da viagem (início − 1h de checklist).
 * >= 0: chega a tempo respeitando o descanso; menor = melhor encaixe (libera
 *       mais cedo, ideal pra viagem mais cedo).
 * <  0: só começaria depois do ideal — viola o descanso, fica por último.
 * null: sem jornada importada — sem base pra ordenar, vai pro fim.
 */
export function calcularFolgaAteIdeal(
  proximoInicioDisponivel: Date | string | null,
  horarioIdeal: Date,
): number | null {
  if (!proximoInicioDisponivel) {
    return null
  }

  const disponivel = new Date(proximoInicioDisponivel)
  return (horarioIdeal.getTime() - disponivel.getTime()) / (60 * 1000)
}

/**
 * Classifica a folga em grupo (ordem de prioridade) + custo (desempate dentro
 * do grupo). Grupo 0 = respeita descanso, 1 = viola, 2 = sem jornada importada.
 */
function classificarFolga(folgaMinutos: number | null): { grupo: number; custo: number } {
  if (folgaMinutos === null) {
    return { grupo: 2, custo: 0 }
  }
  if (folgaMinutos >= 0) {
    // respeita: menor folga = melhor encaixe
    return { grupo: 0, custo: folgaMinutos }
  }
  // viola: menor violação (folga menos negativa) primeiro
  return { grupo: 1, custo: -folgaMinutos }
}

/**
 * Ordena por quem respeita o descanso legal e libera mais perto do horário
 * ideal primeiro (fim de jornada + 11h, ou +35h no 6º dia); quem só ficaria
 * disponível depois do ideal vem em seguida, ordenado por menor violação;
 * quem não tem jornada importada fica por último. Dias disponíveis e nome
 * desempatam dentro do mesmo grupo.
 */
export function filtrarMotoristasCompativeis<T extends MotoristaParaAlocacao>(
  motoristas: T[],
  contexto: ContextoCompatibilidade,
): T[] {
  const horarioIdeal = calcularHorarioIdealChegada(contexto.dataInicioViagem)

  return motoristas
    .filter((motorista) => motoristaEhCompativel(motorista, contexto))
    .sort((a, b) => {
      const folgaA = calcularFolgaAteIdeal(
        calcularProximoInicioDisponivel(
          encontrarFimJornadaAnterior(a.registrosJornada, contexto.dataInicioViagem),
          a.diasTrabalhados,
        ),
        horarioIdeal,
      )
      const folgaB = calcularFolgaAteIdeal(
        calcularProximoInicioDisponivel(
          encontrarFimJornadaAnterior(b.registrosJornada, contexto.dataInicioViagem),
          b.diasTrabalhados,
        ),
        horarioIdeal,
      )

      const chaveA = classificarFolga(folgaA)
      const chaveB = classificarFolga(folgaB)

      // 1) quem respeita o descanso (folga >= 0) vem antes de quem viola/sem dado
      if (chaveA.grupo !== chaveB.grupo) {
        return chaveA.grupo - chaveB.grupo
      }
      // 2) dentro do mesmo grupo, menor "custo" primeiro
      //    - respeita: menor folga (libera mais cedo p/ viagem mais cedo)
      //    - viola: menor violação (fim mais próximo do ideal)
      if (chaveA.custo !== chaveB.custo) {
        return chaveA.custo - chaveB.custo
      }

      const diasDisponiveisA = calcularDiasDisponiveis(codigoJornadaNaViagem(a, contexto))
      const diasDisponiveisB = calcularDiasDisponiveis(codigoJornadaNaViagem(b, contexto))
      return diasDisponiveisB - diasDisponiveisA || a.nome.localeCompare(b.nome)
    })
}
