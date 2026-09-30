import { calcularDiasDisponiveis, codigoJornadaNaViagem, motoristaEhCompativel } from "./compatibilidade"
import { calcularDescansoAntesDaViagem, type MotoristaParaDescanso } from "./descanso"
import { entraNaSugestaoAutomatica } from "../tipo-motorista"
import type { ContextoCompatibilidade, MotoristaParaAlocacao } from "./tipos"

const HORAS_ANTECEDENCIA_CHECKLIST = 1

/** Horário ideal de início de jornada do motorista pra uma viagem: 1h antes, pra dar tempo de checklist. */
export function calcularHorarioIdealChegada(dataInicioViagem: Date): Date {
  return new Date(dataInicioViagem.getTime() - HORAS_ANTECEDENCIA_CHECKLIST * 60 * 60 * 1000)
}

/**
 * Chega a tempo = pode iniciar a jornada (fim do trabalho anterior + 11h, ou
 * +35h depois do 6º dia — ver calcularDescansoAntesDaViagem) até o horário
 * ideal, 1h antes da viagem pro checklist. Sem trabalho anterior conhecido,
 * chega.
 */
export function motoristaChegaATempo<T extends MotoristaParaDescanso>(
  motorista: T,
  contexto: ContextoCompatibilidade,
): boolean {
  const descanso = calcularDescansoAntesDaViagem(motorista, contexto.dataInicioViagem, contexto.hoje)
  const horarioIdeal = calcularHorarioIdealChegada(contexto.dataInicioViagem)

  return !descanso || descanso.inicioPermitido <= horarioIdeal
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
export function filtrarMotoristasCompativeis<T extends MotoristaParaAlocacao & MotoristaParaDescanso>(
  motoristas: T[],
  contexto: ContextoCompatibilidade,
): T[] {
  const horarioIdeal = calcularHorarioIdealChegada(contexto.dataInicioViagem)

  // Chave de ordenação calculada uma vez por motorista (antes era recalculada
  // a cada comparação do sort), a partir da regra única de descanso — a
  // mesma do aviso gravado na viagem (ver calcularDescansoAntesDaViagem).
  // Só o motorista comum é sugerido — instrutor e interno cabem na regra,
  // mas são sempre escolha manual (ver entraNaSugestaoAutomatica).
  const chaves = new Map(
    motoristas
      .filter((motorista) => entraNaSugestaoAutomatica(motorista.tipo))
      .filter((motorista) => motoristaEhCompativel(motorista, contexto))
      .map((motorista) => {
        const descanso = calcularDescansoAntesDaViagem(motorista, contexto.dataInicioViagem, contexto.hoje)
        const folga = calcularFolgaAteIdeal(descanso?.inicioPermitido ?? null, horarioIdeal)
        return [
          motorista,
          {
            ...classificarFolga(folga),
            diasDisponiveis: calcularDiasDisponiveis(codigoJornadaNaViagem(motorista, contexto)),
          },
        ] as const
      }),
  )

  return [...chaves.keys()].sort((a, b) => {
    const chaveA = chaves.get(a)!
    const chaveB = chaves.get(b)!

    // 1) quem respeita o descanso até o horário ideal vem antes de quem viola; sem dado por último
    if (chaveA.grupo !== chaveB.grupo) {
      return chaveA.grupo - chaveB.grupo
    }
    // 2) dentro do mesmo grupo, menor "custo" primeiro
    //    - respeita: menor folga (libera mais cedo p/ viagem mais cedo)
    //    - viola: menor violação (fim mais próximo do ideal)
    if (chaveA.custo !== chaveB.custo) {
      return chaveA.custo - chaveB.custo
    }

    return chaveB.diasDisponiveis - chaveA.diasDisponiveis || a.nome.localeCompare(b.nome)
  })
}
