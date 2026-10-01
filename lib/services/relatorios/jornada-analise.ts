import type { TipoMotorista, Turno } from "@prisma/client"
import { inicioDoDia } from "@/lib/utils/date-format"
import { MAX_DIAS_SEM_FOLGA, folgaEstourada } from "@/lib/services/dias-sem-folga"
import { MINIMO_HORAS_ENTRE_FOLGAS, MINIMO_HORAS_ENTRE_JORNADAS } from "@/lib/services/alocacao/disponibilidade"
import { ocorrenciasRealizadas, viagemDaJornada, type ViagemCircadiano } from "@/lib/services/circadiano.service"

/**
 * Análises sobre o que o Relatório de Jornada mostra que ACONTECEU (horários
 * reais), não sobre o planejado no Escale — base dos relatórios de
 * interjornada realizada, jornadas longas e do painel por motorista.
 */

/** Limite padrão do relatório de jornadas longas. */
export const HORAS_JORNADA_LONGA_PADRAO = 12

const UM_MINUTO_MS = 60_000

export type MotoristaJornada = { id: number; nome: string; turno: Turno; tipo: TipoMotorista }

export type JornadaReal = {
  motoristaId: number
  inicioJornada: Date
  fimJornada: Date
  codigo: number
  /** Dias seguidos sem folga do relatório (null em import anterior a esse campo). */
  diasSemFolga: number | null
}

type DadosDaViagem = {
  atividade: "VIAGEM" | "INTERNO"
  numViagem: string | null
  cavalo: string | null
  carreta: string | null
}

function dadosDaViagem(viagens: ViagemCircadiano[], motoristaId: number, inicio: Date, fim: Date): DadosDaViagem {
  const viagem = viagemDaJornada(viagens, motoristaId, inicio, fim)
  return {
    atividade: viagem ? "VIAGEM" : "INTERNO",
    numViagem: viagem?.numViagem ?? null,
    cavalo: viagem?.cavalo ?? null,
    carreta: viagem?.carreta ?? null,
  }
}

function minutosEntre(inicio: Date, fim: Date): number {
  return Math.round((fim.getTime() - inicio.getTime()) / UM_MINUTO_MS)
}

function porMotorista(jornadas: JornadaReal[]): Map<number, JornadaReal[]> {
  const mapa = new Map<number, JornadaReal[]>()
  for (const jornada of jornadas) {
    const lista = mapa.get(jornada.motoristaId) ?? []
    lista.push(jornada)
    mapa.set(jornada.motoristaId, lista)
  }
  for (const lista of mapa.values()) {
    lista.sort((a, b) => a.inicioJornada.getTime() - b.inicioJornada.getTime())
  }
  return mapa
}

function dentro(instante: Date, de: Date, ate: Date) {
  return instante >= de && instante <= ate
}

/** Dia seguido em que a jornada caiu: o do relatório, ou o código do calendário (já limitado a 6). */
function diaDoCiclo(jornada: JornadaReal): number {
  return jornada.diasSemFolga ?? jornada.codigo
}

// ---------------------------------------------------------------------------
// 1. Interjornada realizada
// ---------------------------------------------------------------------------

export type DescansoDescumprido = {
  motoristaId: number
  motorista: string
  turno: Turno
  /** INTERJORNADA = mínimo de 11h; SEMANAL = 35h depois do 6º dia seguido. */
  tipo: "INTERJORNADA" | "SEMANAL"
  fimAnterior: Date
  inicioSeguinte: Date
  descansoMinutos: number
  minimoHoras: number
  faltaramMinutos: number
} & DadosDaViagem

/**
 * Pares de jornadas seguidas do mesmo motorista com descanso menor que o
 * mínimo: 11h normalmente, 35h quando a anterior foi o 6º dia (ou mais)
 * seguido (exceto quando a seguinte já é o 7º dia sem folga — esse caso é
 * do relatório de dias sem folga). Conta pela jornada SEGUINTE dentro do período; a viagem mostrada
 * é a dela. Intervalo negativo (relatório com horários sobrepostos) é
 * ignorado.
 */
export function descansosDescumpridos(
  motoristas: MotoristaJornada[],
  jornadas: JornadaReal[],
  viagens: ViagemCircadiano[],
  de: Date,
  ate: Date,
): DescansoDescumprido[] {
  const porId = new Map(motoristas.map((motorista) => [motorista.id, motorista]))
  const ocorrencias: DescansoDescumprido[] = []

  for (const [motoristaId, lista] of porMotorista(jornadas)) {
    const motorista = porId.get(motoristaId)
    if (!motorista) continue

    for (let i = 1; i < lista.length; i++) {
      const anterior = lista[i - 1]
      const seguinte = lista[i]
      if (!dentro(seguinte.inicioJornada, de, ate)) continue

      const descansoMinutos = minutosEntre(anterior.fimJornada, seguinte.inicioJornada)
      if (descansoMinutos < 0) continue

      const semanal = diaDoCiclo(anterior) >= MAX_DIAS_SEM_FOLGA
      // Seguiu sem folga (7º dia ou mais): já aparece em "Dias sem folga" —
      // não repete aqui como descanso semanal, é o mesmo fato.
      if (semanal && folgaEstourada(seguinte.diasSemFolga)) continue
      const minimoHoras = semanal ? MINIMO_HORAS_ENTRE_FOLGAS : MINIMO_HORAS_ENTRE_JORNADAS
      if (descansoMinutos >= minimoHoras * 60) continue

      ocorrencias.push({
        motoristaId,
        motorista: motorista.nome,
        turno: motorista.turno,
        tipo: semanal ? "SEMANAL" : "INTERJORNADA",
        fimAnterior: anterior.fimJornada,
        inicioSeguinte: seguinte.inicioJornada,
        descansoMinutos,
        minimoHoras,
        faltaramMinutos: minimoHoras * 60 - descansoMinutos,
        ...dadosDaViagem(viagens, motoristaId, seguinte.inicioJornada, seguinte.fimJornada),
      })
    }
  }

  return ocorrencias.sort((a, b) => b.inicioSeguinte.getTime() - a.inicioSeguinte.getTime())
}

// ---------------------------------------------------------------------------
// 2. Jornadas longas
// ---------------------------------------------------------------------------

export type JornadaLonga = {
  motoristaId: number
  motorista: string
  turno: Turno
  inicio: Date
  fim: Date
  duracaoMinutos: number
  excedenteMinutos: number
} & DadosDaViagem

export function jornadasLongas(
  motoristas: MotoristaJornada[],
  jornadas: JornadaReal[],
  viagens: ViagemCircadiano[],
  de: Date,
  ate: Date,
  limiteHoras = HORAS_JORNADA_LONGA_PADRAO,
): JornadaLonga[] {
  const porId = new Map(motoristas.map((motorista) => [motorista.id, motorista]))
  const ocorrencias: JornadaLonga[] = []

  for (const jornada of jornadas) {
    const motorista = porId.get(jornada.motoristaId)
    if (!motorista || !dentro(jornada.inicioJornada, de, ate)) continue

    const duracaoMinutos = minutosEntre(jornada.inicioJornada, jornada.fimJornada)
    if (duracaoMinutos <= limiteHoras * 60) continue

    ocorrencias.push({
      motoristaId: motorista.id,
      motorista: motorista.nome,
      turno: motorista.turno,
      inicio: jornada.inicioJornada,
      fim: jornada.fimJornada,
      duracaoMinutos,
      excedenteMinutos: duracaoMinutos - limiteHoras * 60,
      ...dadosDaViagem(viagens, motorista.id, jornada.inicioJornada, jornada.fimJornada),
    })
  }

  return ocorrencias.sort((a, b) => b.inicio.getTime() - a.inicio.getTime())
}

// ---------------------------------------------------------------------------
// 3. Painel por motorista
// ---------------------------------------------------------------------------

export type LinhaPainelMotorista = {
  motoristaId: number
  motorista: string
  turno: Turno
  tipo: TipoMotorista
  diasTrabalhados: number
  horasTrabalhadasMinutos: number
  maiorJornadaMinutos: number
  viagens: number
  circadiano: number
  diasSemFolgaEstourados: number
  descansosDescumpridos: number
  jornadasLongas: number
  /** Soma das ocorrências — ordena quem precisa de atenção primeiro. */
  totalAlertas: number
}

/**
 * Uma linha por motorista ativo: quanto trabalhou no período (pelo relatório
 * de jornada), quantas viagens fez no Escale e quantas vezes caiu em cada
 * alerta. Quem precisa de atenção primeiro; depois quem trabalhou mais.
 */
export function painelPorMotorista(
  motoristas: MotoristaJornada[],
  jornadas: JornadaReal[],
  viagens: ViagemCircadiano[],
  de: Date,
  ate: Date,
): LinhaPainelMotorista[] {
  const noPeriodo = jornadas.filter((jornada) => dentro(jornada.inicioJornada, de, ate))
  const contar = <T extends { motoristaId: number }>(itens: T[]) => {
    const mapa = new Map<number, number>()
    for (const item of itens) mapa.set(item.motoristaId, (mapa.get(item.motoristaId) ?? 0) + 1)
    return mapa
  }

  const circadiano = contar(ocorrenciasRealizadas(motoristas, noPeriodo, viagens))
  const descansos = contar(descansosDescumpridos(motoristas, jornadas, viagens, de, ate))
  const longas = contar(jornadasLongas(motoristas, jornadas, viagens, de, ate))
  const semFolga = contar(noPeriodo.filter((jornada) => folgaEstourada(jornada.diasSemFolga)))
  const jornadasPorMotorista = porMotorista(noPeriodo)

  const viagensPorMotorista = new Map<number, number>()
  for (const viagem of viagens) {
    if (viagem.status === "CANCELADA" || !dentro(new Date(viagem.inicioPrevisto), de, ate)) continue
    for (const id of new Set([viagem.motoristaId, viagem.motoristaAcompanhanteId])) {
      if (id !== null) viagensPorMotorista.set(id, (viagensPorMotorista.get(id) ?? 0) + 1)
    }
  }

  return motoristas
    .map((motorista) => {
      const lista = jornadasPorMotorista.get(motorista.id) ?? []
      const duracoes = lista.map((jornada) => minutosEntre(jornada.inicioJornada, jornada.fimJornada))
      const dias = new Set(lista.map((jornada) => inicioDoDia(jornada.inicioJornada).getTime()))
      const linha = {
        motoristaId: motorista.id,
        motorista: motorista.nome,
        turno: motorista.turno,
        tipo: motorista.tipo,
        diasTrabalhados: dias.size,
        horasTrabalhadasMinutos: duracoes.reduce((soma, minutos) => soma + Math.max(0, minutos), 0),
        maiorJornadaMinutos: duracoes.length > 0 ? Math.max(...duracoes) : 0,
        viagens: viagensPorMotorista.get(motorista.id) ?? 0,
        circadiano: circadiano.get(motorista.id) ?? 0,
        diasSemFolgaEstourados: semFolga.get(motorista.id) ?? 0,
        descansosDescumpridos: descansos.get(motorista.id) ?? 0,
        jornadasLongas: longas.get(motorista.id) ?? 0,
      }
      return {
        ...linha,
        totalAlertas: linha.circadiano + linha.diasSemFolgaEstourados + linha.descansosDescumpridos + linha.jornadasLongas,
      }
    })
    .sort(
      (a, b) =>
        b.totalAlertas - a.totalAlertas ||
        b.horasTrabalhadasMinutos - a.horasTrabalhadasMinutos ||
        a.motorista.localeCompare(b.motorista, "pt-BR"),
    )
}
