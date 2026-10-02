import type { StatusViagem, Turno } from "@prisma/client"
import { inicioDoDia } from "@/lib/utils/date-format"
import { fimEfetivoViagem } from "./alocacao/disponibilidade"
import { turnoDaJornada } from "./turno"

/**
 * Ciclo circadiano: jornada que passa do horário de descanso do turno.
 * - Turno do dia (MANHA): não pode passar das 22:00.
 * - Turno da noite (NOITE): não pode passar das 05:00.
 * O turno é o da JORNADA, pelo horário de início (ver turnoDaJornada: Dia
 * de 04:00 a 15:59, Noite de 16:00 a 03:59) — não o do cadastro do
 * motorista, que não acompanha quando ele troca de turno.
 * Conta só pelo FIM da jornada: o limite é a primeira vez que o relógio
 * marca esse horário depois do início (motorista do dia que começa às 06:00
 * tem limite às 22:00 do mesmo dia; o da noite que começa às 18:00, às 05:00
 * do dia seguinte).
 */
const HORA_LIMITE_POR_TURNO: Record<Turno, number> = {
  MANHA: 22,
  NOITE: 5,
}

/**
 * Previsão de jornada a partir de uma viagem agendada: o motorista começa no
 * início da viagem e trabalha até 12h depois (ou até o fim previsto da
 * viagem, se ela acabar antes). Ex: viagem às 11:00 → jornada até 23:00.
 * Em viagem de vários dias só o primeiro dia é previsível assim.
 */
const HORAS_JORNADA_PREVISTA = 12

const UMA_HORA_MS = 60 * 60 * 1000

type MotoristaCircadiano = { id: number; nome: string }

type JornadaRealizada = {
  motoristaId: number
  inicioJornada: Date
  fimJornada: Date
}

export type ViagemCircadiano = {
  id: number
  numViagem: string
  cavalo: string
  carreta: string
  status: StatusViagem
  inicioPrevisto: Date
  fimPrevisto: Date
  finalizadoEm?: Date | null
  motoristaId: number | null
  motoristaAcompanhanteId: number | null
}

export type OcorrenciaCircadiano = {
  tipo: "REALIZADO" | "PREVISTO"
  motoristaId: number
  motorista: string
  turno: Turno
  /** Dia (meia-noite de Brasília) em que a jornada começou. */
  dia: Date
  inicio: Date
  fim: Date
  /** Horário que não podia ser passado (22:00 ou 05:00). */
  limite: Date
  minutosExcedidos: number
  /** VIAGEM = havia viagem do Escale no horário; INTERNO = não havia. */
  atividade: "VIAGEM" | "INTERNO"
  numViagem: string | null
  cavalo: string | null
  carreta: string | null
}

/** Primeira ocorrência de `hora`:00 (Brasília) estritamente depois de `inicio`. */
export function limiteCircadiano(inicio: Date, turno: Turno): Date {
  const limite = new Date(inicioDoDia(inicio).getTime() + HORA_LIMITE_POR_TURNO[turno] * UMA_HORA_MS)
  return limite > inicio ? limite : new Date(limite.getTime() + 24 * UMA_HORA_MS)
}

function minutosExcedidos(fim: Date, limite: Date): number {
  return Math.round((fim.getTime() - limite.getTime()) / 60_000)
}

function viagemConta(viagem: ViagemCircadiano) {
  return viagem.status !== "CANCELADA"
}

function envolveMotorista(viagem: ViagemCircadiano, motoristaId: number) {
  return viagem.motoristaId === motoristaId || viagem.motoristaAcompanhanteId === motoristaId
}

/** Viagem do motorista que mais se sobrepõe à jornada (null = estava interno). */
export function viagemDaJornada(
  viagens: ViagemCircadiano[],
  motoristaId: number,
  inicio: Date,
  fim: Date,
): ViagemCircadiano | null {
  let melhor: ViagemCircadiano | null = null
  let melhorSobreposicao = 0

  for (const viagem of viagens) {
    if (!viagemConta(viagem) || !envolveMotorista(viagem, motoristaId)) continue
    const inicioViagem = new Date(viagem.inicioPrevisto)
    const fimViagem = fimEfetivoViagem(viagem)
    const sobreposicao =
      Math.min(fim.getTime(), fimViagem.getTime()) - Math.max(inicio.getTime(), inicioViagem.getTime())
    if (sobreposicao > melhorSobreposicao) {
      melhor = viagem
      melhorSobreposicao = sobreposicao
    }
  }

  return melhor
}

function dadosDaViagem(viagem: ViagemCircadiano | null) {
  return {
    atividade: viagem ? ("VIAGEM" as const) : ("INTERNO" as const),
    numViagem: viagem?.numViagem ?? null,
    cavalo: viagem?.cavalo ?? null,
    carreta: viagem?.carreta ?? null,
  }
}

/**
 * Jornadas reais (do Relatório de Jornada) que terminaram depois do limite do
 * turno, com a viagem do Escale que o motorista fazia naquele horário.
 */
export function ocorrenciasRealizadas(
  motoristas: MotoristaCircadiano[],
  jornadas: JornadaRealizada[],
  viagens: ViagemCircadiano[],
): OcorrenciaCircadiano[] {
  const porId = new Map(motoristas.map((motorista) => [motorista.id, motorista]))
  const ocorrencias: OcorrenciaCircadiano[] = []

  for (const jornada of jornadas) {
    const motorista = porId.get(jornada.motoristaId)
    if (!motorista) continue

    const inicio = new Date(jornada.inicioJornada)
    const fim = new Date(jornada.fimJornada)
    const turno = turnoDaJornada(inicio)
    const limite = limiteCircadiano(inicio, turno)
    if (fim <= limite) continue

    ocorrencias.push({
      tipo: "REALIZADO",
      motoristaId: motorista.id,
      motorista: motorista.nome,
      turno,
      dia: inicioDoDia(inicio),
      inicio,
      fim,
      limite,
      minutosExcedidos: minutosExcedidos(fim, limite),
      ...dadosDaViagem(viagemDaJornada(viagens, motorista.id, inicio, fim)),
    })
  }

  return ocorrencias
}

/**
 * Viagens agendadas que vão fazer o motorista (principal ou acompanhante)
 * passar do limite do turno — o aviso antes de acontecer. Só viagens que o
 * relatório ainda não cobre (começam depois de `relatorioAte`), pra não
 * duplicar o que já aparece como realizado, e que ainda não terminaram.
 */
export function ocorrenciasPrevistas(
  motoristas: MotoristaCircadiano[],
  viagens: ViagemCircadiano[],
  relatorioAte: Date | null,
): OcorrenciaCircadiano[] {
  const porId = new Map(motoristas.map((motorista) => [motorista.id, motorista]))
  const ocorrencias: OcorrenciaCircadiano[] = []
  const fimCobertura = relatorioAte ? new Date(inicioDoDia(relatorioAte).getTime() + 24 * UMA_HORA_MS) : null

  for (const viagem of viagens) {
    if (!viagemConta(viagem) || viagem.status === "FINALIZADA") continue

    const inicio = new Date(viagem.inicioPrevisto)
    if (fimCobertura && inicio < fimCobertura) continue

    const fimViagem = new Date(viagem.fimPrevisto)
    const fimJornada = new Date(Math.min(fimViagem.getTime(), inicio.getTime() + HORAS_JORNADA_PREVISTA * UMA_HORA_MS))

    for (const motoristaId of [viagem.motoristaId, viagem.motoristaAcompanhanteId]) {
      const motorista = motoristaId !== null ? porId.get(motoristaId) : undefined
      if (!motorista) continue

      const turno = turnoDaJornada(inicio)
      const limite = limiteCircadiano(inicio, turno)
      if (fimJornada <= limite) continue

      ocorrencias.push({
        tipo: "PREVISTO",
        motoristaId: motorista.id,
        motorista: motorista.nome,
        turno,
        dia: inicioDoDia(inicio),
        inicio,
        fim: fimJornada,
        limite,
        minutosExcedidos: minutosExcedidos(fimJornada, limite),
        ...dadosDaViagem(viagem),
      })
    }
  }

  return ocorrencias
}

/** "recentes": mais recentes primeiro (realizadas). "proximas": mais próximas primeiro (previstas). No mesmo dia, por nome. */
export function ordenarOcorrencias(
  ocorrencias: OcorrenciaCircadiano[],
  ordem: "recentes" | "proximas" = "recentes",
): OcorrenciaCircadiano[] {
  const sentido = ordem === "recentes" ? -1 : 1
  return [...ocorrencias].sort(
    (a, b) =>
      sentido * (a.dia.getTime() - b.dia.getTime()) || a.motorista.localeCompare(b.motorista, "pt-BR"),
  )
}

export function formatarExcedente(minutos: number): string {
  const horas = Math.floor(minutos / 60)
  const resto = minutos % 60
  if (horas === 0) return `${resto} min`
  return resto === 0 ? `${horas}h` : `${horas}h${String(resto).padStart(2, "0")}`
}
