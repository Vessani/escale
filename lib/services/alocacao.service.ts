import { StatusIntegracao, StatusViagem, Turno } from "@prisma/client"
import { encontrarFimJornadaAnterior, projetarCodigoNoDia, type PontoRegistroJornada } from "./jornada.service"

/** Máximo de dias consecutivos de trabalho antes da folga obrigatória — mesmo limite usado pra capar o "Dias Sem Folga" importado do relatório (ver jornada-relatorio.service.ts). */
export const MAX_DIAS_CONSECUTIVOS = 6

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
  /** false = em treinamento — nunca compatível como motorista principal (ver motoristaEhCompativel). */
  liberado: boolean
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

/**
 * `clientesQueExigemIntegracao` já vem normalizado (trim + maiúsculas) — ver
 * buscarNomesClientesQueExigemIntegracao (lib/queries/clientes.ts), que
 * substituiu a antiga lista fixa no código.
 */
export function calcularIntegracaoExigida(
  entregas: Array<{ cliente: string }>,
  clientesQueExigemIntegracao: Set<string>,
) {
  for (const entrega of entregas) {
    const clienteNormalizado = normalizarCliente(entrega.cliente)
    if (clientesQueExigemIntegracao.has(clienteNormalizado)) {
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

const MINIMO_HORAS_ENTRE_JORNADAS = 11
const MINIMO_HORAS_ENTRE_FOLGAS = 35

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

export function motoristaEhCompativel(
  motorista: MotoristaParaAlocacao,
  contexto: ContextoCompatibilidade,
) {
  if (!motorista.liberado) {
    return false
  }

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
 */
function descansoMinimoNecessarioApos(motorista: MotoristaParaAlocacao, fimViagemExistente: Date, hoje: Date) {
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

export function sugerirMotoristaAutomatico(
  motoristas: MotoristaComAgenda[],
  fimViagem: Date,
  contexto: ContextoCompatibilidade,
) {
  const disponiveis = filtrarMotoristasDisponiveisNoPeriodo(
    motoristas,
    contexto.dataInicioViagem,
    fimViagem,
    contexto.hoje,
  )
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
  motorista: MotoristaComAgenda
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
      hoje,
    )

    const motoristasCompativeis = filtrarMotoristasCompativeis(motoristasDisponiveis, contexto).filter(
      (motorista) =>
        !atribuicoesTentativas.some((atribuicao) => {
          if (atribuicao.motoristaId !== motorista.id) return false

          const minimoHoras = descansoMinimoNecessarioApos(atribuicao.motorista, atribuicao.fim, hoje)
          return periodosConflitamComDescanso(
            viagem.inicioPrevisto,
            viagem.fimPrevisto,
            atribuicao.inicio,
            atribuicao.fim,
            minimoHoras,
          )
        }),
    )

    // motoristasCompativeis já está filtrado e ordenado por filtrarMotoristasCompativeis
    // (mesmo critério usado por sugerirMotoristaAutomatico); o primeiro é o sugerido.
    const motoristaSugerido = motoristasCompativeis[0] ?? null

    if (motoristaSugerido) {
      atribuicoesTentativas.push({
        motoristaId: motoristaSugerido.id,
        motorista: motoristaSugerido,
        inicio: viagem.inicioPrevisto,
        fim: viagem.fimPrevisto,
      })
    }

    return { viagemId: viagem.id, motoristasCompativeis, motoristaSugerido }
  })
}
