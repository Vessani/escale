import { StatusIntegracao, StatusViagem, Turno } from "@prisma/client"
import { inicioDoDia } from "@/lib/utils/date-format"
import { projetarCodigoNoDia, type PontoRegistroJornada } from "./jornada.service"

/** Máximo de dias consecutivos de trabalho antes da folga obrigatória — mesmo limite usado pra capar o "Dias Sem Folga" importado do relatório (ver jornada-relatorio.service.ts). */
export const MAX_DIAS_CONSECUTIVOS = 6

const CLIENTES_COM_INTEGRACAO_OBRIGATORIA = new Set([
  "GEMP - AMBEV - BEBIDAS - N2L. (GRUPO AMB",
  "WEG",
])

type IntegracaoBase = {
  cliente: string
  status: StatusIntegracao
  dataValidade: Date | string
}

type MotoristaParaAlocacao = {
  id: number
  nome: string
  turno: Turno
  diasTrabalhados: number
  integracao: IntegracaoBase[]
  registrosJornada: PontoRegistroJornada[]
  /** Último registro do Relatório Sintético de Jornada importado (ver jornada-relatorio.service.ts). */
  jornadaRelatorioInicio: Date | string | null
  jornadaRelatorioFim: Date | string | null
}

type ViagemParaDisponibilidade = {
  id: number
  inicioPrevisto: Date | string
  fimPrevisto: Date | string
  status: StatusViagem
  deletadoEm?: Date | string | null
}

type MotoristaComAgenda = MotoristaParaAlocacao & {
  viagens: ViagemParaDisponibilidade[]
}

type ContextoCompatibilidade = {
  turnoViagem: Turno
  diasViagem: number
  dataInicioViagem: Date
  integracaoExigida: string | null
  /** "Hoje" do ponto de vista de quem está alocando — âncora usada para projetar a jornada do motorista em `dataInicioViagem`. */
  hoje: Date
}

function normalizarCliente(cliente: string) {
  return cliente.trim().toUpperCase()
}

/**
 * Dias consecutivos que o motorista ainda pode trabalhar a partir do código
 * informado. Códigos fora de 1-6 (Folga, Férias, Exames, Interno) retornam 0:
 * o motorista só volta a ficar disponível no dia seguinte, quando a rotação
 * o traz de volta ao início do ciclo (ver `jornada.service.ts`).
 */
export function calcularDiasDisponiveis(diasTrabalhados: number) {
  if (diasTrabalhados < 1 || diasTrabalhados > MAX_DIAS_CONSECUTIVOS) {
    return 0
  }

  return MAX_DIAS_CONSECUTIVOS - diasTrabalhados
}

export function calcularIntegracaoExigida(entregas: Array<{ cliente: string }>) {
  for (const entrega of entregas) {
    const clienteNormalizado = normalizarCliente(entrega.cliente)
    if (CLIENTES_COM_INTEGRACAO_OBRIGATORIA.has(clienteNormalizado)) {
      return clienteNormalizado
    }
  }

  return null
}

function temIntegracaoValida(
  motorista: MotoristaParaAlocacao,
  cliente: string,
  dataInicioViagem: Date,
) {
  const clienteNormalizado = normalizarCliente(cliente)

  return motorista.integracao.some((integracao) => {
    return (
      normalizarCliente(integracao.cliente) === clienteNormalizado &&
      integracao.status === "ATIVO" &&
      new Date(integracao.dataValidade) >= dataInicioViagem
    )
  })
}

/** Código de jornada do motorista projetado para a data real de início da viagem (não o cache de "hoje"). */
function codigoJornadaNaViagem(motorista: MotoristaParaAlocacao, contexto: ContextoCompatibilidade) {
  return projetarCodigoNoDia(
    motorista.registrosJornada,
    contexto.dataInicioViagem,
    contexto.hoje,
    motorista.diasTrabalhados,
  )
}

const HORAS_ANTECEDENCIA_CHECKLIST = 1

/** Horário ideal de início de jornada do motorista pra uma viagem: 1h antes, pra dar tempo de checklist. */
export function calcularHorarioIdealChegada(dataInicioViagem: Date): Date {
  return new Date(dataInicioViagem.getTime() - HORAS_ANTECEDENCIA_CHECKLIST * 60 * 60 * 1000)
}

/**
 * Distância em minutos entre o horário habitual de início de jornada do
 * motorista (só a hora do dia, não a data — o registro do relatório é de um
 * dia qualquer do período coberto) e o horário ideal calculado pra viagem.
 * Circular: 23:50 e 00:10 têm distância 20, não 1420. `null` quando o
 * motorista nunca teve jornada importada — esses ficam por último na
 * ordenação, não são excluídos.
 */
export function calcularDistanciaHorarioHabitual(
  jornadaInicioHabitual: Date | string | null,
  horarioIdeal: Date,
): number | null {
  if (!jornadaInicioHabitual) {
    return null
  }

  const habitual = new Date(jornadaInicioHabitual)
  const minutosHabitual = habitual.getHours() * 60 + habitual.getMinutes()
  const minutosIdeal = horarioIdeal.getHours() * 60 + horarioIdeal.getMinutes()
  const diferenca = Math.abs(minutosHabitual - minutosIdeal)

  return Math.min(diferenca, 1440 - diferenca)
}

const MINIMO_HORAS_ENTRE_JORNADAS = 11

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

export function motoristaEhCompativel(
  motorista: MotoristaParaAlocacao,
  contexto: ContextoCompatibilidade,
) {
  if (motorista.turno !== contexto.turnoViagem) {
    return false
  }

  const codigoNaViagem = codigoJornadaNaViagem(motorista, contexto)

  if (calcularDiasDisponiveis(codigoNaViagem) < contexto.diasViagem) {
    return false
  }

  if (!contexto.integracaoExigida) {
    return true
  }

  return temIntegracaoValida(motorista, contexto.integracaoExigida, contexto.dataInicioViagem)
}

/**
 * Ordena por proximidade de horário habitual de jornada primeiro (quem não
 * tem dado de relatório fica por último), dias disponíveis como desempate,
 * nome como desempate final.
 */
export function filtrarMotoristasCompativeis<T extends MotoristaParaAlocacao>(
  motoristas: T[],
  contexto: ContextoCompatibilidade,
): T[] {
  const horarioIdeal = calcularHorarioIdealChegada(contexto.dataInicioViagem)

  return motoristas
    .filter((motorista) => motoristaEhCompativel(motorista, contexto))
    .sort((a, b) => {
      const distanciaA = calcularDistanciaHorarioHabitual(a.jornadaRelatorioInicio, horarioIdeal)
      const distanciaB = calcularDistanciaHorarioHabitual(b.jornadaRelatorioInicio, horarioIdeal)

      if (distanciaA !== distanciaB) {
        if (distanciaA === null) return 1
        if (distanciaB === null) return -1
        return distanciaA - distanciaB
      }

      const diasDisponiveisA = calcularDiasDisponiveis(codigoJornadaNaViagem(a, contexto))
      const diasDisponiveisB = calcularDiasDisponiveis(codigoJornadaNaViagem(b, contexto))
      return diasDisponiveisB - diasDisponiveisA || a.nome.localeCompare(b.nome)
    })
}

export function periodoConflita(inicioA: Date, fimA: Date, inicioB: Date, fimB: Date) {
  return inicioA < fimB && fimA > inicioB
}

function viagemBloqueiaAgenda(viagem: ViagemParaDisponibilidade) {
  if (viagem.deletadoEm) {
    return false
  }

  return viagem.status !== "CANCELADA" && viagem.status !== "FINALIZADA"
}

/** Primeiro dia (00:00) em que o motorista está livre após o fim de uma viagem: o dia seguinte ao dia em que ela termina. */
function primeiroDiaDisponivelApos(fimViagem: Date): Date {
  const dia = inicioDoDia(fimViagem)
  dia.setDate(dia.getDate() + 1)
  return dia
}

/**
 * Duas viagens conflitam por descanso se, olhando só a data (não a hora exata),
 * uma delas começa antes do primeiro dia livre após o fim da outra — ou seja,
 * exige pelo menos um dia calendário inteiro de descanso entre o fim de uma
 * viagem e o início da próxima. Ex: viagem termina dia 9, só libera dia 10.
 */
export function periodosConflitamComDescanso(inicioA: Date, fimA: Date, inicioB: Date, fimB: Date) {
  return periodoConflita(
    inicioDoDia(inicioA),
    primeiroDiaDisponivelApos(fimA),
    inicioDoDia(inicioB),
    primeiroDiaDisponivelApos(fimB),
  )
}

export function motoristaEstaDisponivelNoPeriodo(
  motorista: MotoristaComAgenda,
  inicioViagem: Date,
  fimViagem: Date,
) {
  return !motorista.viagens.some((viagem) => {
    if (!viagemBloqueiaAgenda(viagem)) {
      return false
    }

    return periodosConflitamComDescanso(
      new Date(viagem.inicioPrevisto),
      new Date(viagem.fimPrevisto),
      inicioViagem,
      fimViagem,
    )
  })
}

export function filtrarMotoristasDisponiveisNoPeriodo(
  motoristas: MotoristaComAgenda[],
  inicioViagem: Date,
  fimViagem: Date,
) {
  return motoristas.filter((motorista) =>
    motoristaEstaDisponivelNoPeriodo(motorista, inicioViagem, fimViagem),
  )
}

export function sugerirMotoristaAutomatico(
  motoristas: MotoristaComAgenda[],
  fimViagem: Date,
  contexto: ContextoCompatibilidade,
) {
  const disponiveis = filtrarMotoristasDisponiveisNoPeriodo(motoristas, contexto.dataInicioViagem, fimViagem)
  const compativeis = filtrarMotoristasCompativeis(disponiveis, contexto)
  return compativeis[0] ?? null
}

type ViagemParaSugestaoLote = {
  id: number
  turno: Turno
  diasViagem: number
  inicioPrevisto: Date
  fimPrevisto: Date
  integracaoExigida: string | null
}

type AtribuicaoTentativa = {
  motoristaId: number
  inicio: Date
  fim: Date
}

export type SugestaoAlocacaoLote = {
  viagemId: number
  motoristasCompativeis: MotoristaComAgenda[]
  motoristaSugerido: MotoristaComAgenda | null
}

/**
 * Sugere motorista para um lote de viagens pendentes, processando em ordem e
 * levando em conta as sugestões já feitas às viagens anteriores do mesmo lote:
 * se duas viagens têm período sobreposto, a segunda não recebe o motorista já
 * sugerido para a primeira, mesmo que ele também seja compatível para ela.
 * Também exclui motoristas com viagem real conflitante já registrada no banco.
 */
export function sugerirAlocacoesEmLote(
  viagens: ViagemParaSugestaoLote[],
  motoristas: MotoristaComAgenda[],
  hoje: Date,
): SugestaoAlocacaoLote[] {
  const atribuicoesTentativas: AtribuicaoTentativa[] = []

  return viagens.map((viagem) => {
    const contexto: ContextoCompatibilidade = {
      turnoViagem: viagem.turno,
      diasViagem: viagem.diasViagem,
      dataInicioViagem: viagem.inicioPrevisto,
      integracaoExigida: viagem.integracaoExigida,
      hoje,
    }

    const motoristasDisponiveis = filtrarMotoristasDisponiveisNoPeriodo(
      motoristas,
      viagem.inicioPrevisto,
      viagem.fimPrevisto,
    )

    const motoristasCompativeis = filtrarMotoristasCompativeis(motoristasDisponiveis, contexto).filter(
      (motorista) =>
        !atribuicoesTentativas.some(
          (atribuicao) =>
            atribuicao.motoristaId === motorista.id &&
            periodosConflitamComDescanso(viagem.inicioPrevisto, viagem.fimPrevisto, atribuicao.inicio, atribuicao.fim),
        ),
    )

    // motoristasCompativeis já está filtrado e ordenado por filtrarMotoristasCompativeis
    // (mesmo critério usado por sugerirMotoristaAutomatico); o primeiro é o sugerido.
    const motoristaSugerido = motoristasCompativeis[0] ?? null

    if (motoristaSugerido) {
      atribuicoesTentativas.push({
        motoristaId: motoristaSugerido.id,
        inicio: viagem.inicioPrevisto,
        fim: viagem.fimPrevisto,
      })
    }

    return { viagemId: viagem.id, motoristasCompativeis, motoristaSugerido }
  })
}
