import { inicioDoDia } from "@/lib/utils/date-format"
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
 * já concluída ainda define quando o motorista pode iniciar a próxima, a
 * partir do fim efetivo (ver fimEfetivoViagem), não do fim previsto (ver
 * MINIMO_HORAS_ENTRE_JORNADAS/MINIMO_HORAS_ENTRE_FOLGAS); a consulta que
 * carrega `motorista.viagens` (lib/queries/motoristas.ts) já limita
 * viagens FINALIZADA às recentes, então esta função não precisa repetir esse
 * corte por tempo.
 */
export function viagemBloqueiaAgenda(viagem: ViagemParaDisponibilidade) {
  if (viagem.deletadoEm) {
    return false
  }

  return viagem.status !== "CANCELADA"
}

/**
 * O Relatório de Jornada (rastreador) prevalece sobre o Escale nos dias que
 * ele cobre: se a viagem caiu inteira em dias já cobertos pelo relatório e
 * ele não mostra o motorista trabalhando em NENHUM desses dias, a viagem não
 * aconteceu (ou foi com outro motorista) e não conta como trabalho — nem pro
 * descanso de 11h/35h, nem como agenda ocupada. Caso real: viagem esquecida
 * como "Alocada" num dia de folga gerava aviso de interjornada no primeiro
 * dia de trabalho seguinte.
 *
 * Só vale com evidência: a filial precisa ter relatório importado cobrindo o
 * último dia da viagem, e o motorista precisa aparecer no relatório (algum
 * dia com horário real) desde antes da viagem — senão "não aparecer" pode
 * ser só "não é rastreado" ou "relatório de antes dele entrar".
 */
export function viagemDesmentidaPeloRelatorio(
  motorista: Pick<MotoristaParaAlocacao, "registrosJornada" | "relatorioJornadaAte">,
  viagem: ViagemParaDisponibilidade,
): boolean {
  if (!motorista.relatorioJornadaAte) return false

  const primeiroDia = inicioDoDia(new Date(viagem.inicioPrevisto))
  const ultimoDia = inicioDoDia(fimEfetivoViagem(viagem))
  if (ultimoDia > inicioDoDia(motorista.relatorioJornadaAte)) return false

  let apareceAntes = false
  for (const registro of motorista.registrosJornada) {
    if (!registro.fimJornada) continue
    const dia = inicioDoDia(registro.data)
    if (dia >= primeiroDia && dia <= ultimoDia) return false
    if (dia < primeiroDia) apareceAntes = true
  }

  return apareceAntes
}

/**
 * Quando o motorista de fato ficou livre de uma viagem: marcar FINALIZADA
 * libera o motorista a partir desse instante (`finalizadoEm`), se for antes
 * do fim previsto — a rota encerrou mais cedo e quem escala sabe disso. O
 * descanso mínimo (11h/35h) continua contando, só que a partir daqui, não do
 * fim planejado. Nunca antes do início previsto (finalizar por engano antes
 * de a viagem começar não cria um "fim" anterior ao início). Viagem não
 * finalizada, ou finalizada antes da coluna existir, usa o fim previsto.
 */
export function fimEfetivoViagem(viagem: ViagemParaDisponibilidade): Date {
  const fimPrevisto = new Date(viagem.fimPrevisto)

  if (viagem.status !== "FINALIZADA" || !viagem.finalizadoEm) {
    return fimPrevisto
  }

  const finalizadoEm = new Date(viagem.finalizadoEm)
  const inicioPrevisto = new Date(viagem.inicioPrevisto)
  const fim = finalizadoEm < fimPrevisto ? finalizadoEm : fimPrevisto
  return fim < inicioPrevisto ? inicioPrevisto : fim
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
 * termina — mesma regra de calcularDescansoAntesDaViagem (descanso.ts), aplicada aqui
 * contra a própria agenda do motorista no sistema (não só o relatório
 * importado). Sem isso, o reset da rotação (código 7 → 1 na virada pro dia
 * seguinte à Folga) somado ao mínimo de 11h deixaria passar uma viagem nova
 * horas depois da meia-noite seguinte à Folga, bem antes das 35h reais desde
 * que o motorista realmente parou de trabalhar.
 *
 * Exportada porque sugestao.ts também precisa dela ao verificar conflito
 * entre atribuições dentro do mesmo lote (ver sugerirAlocacoesEmLote).
 */
export function descansoMinimoNecessarioApos(
  motorista: Pick<MotoristaParaAlocacao, "registrosJornada" | "diasTrabalhados">,
  fimViagemExistente: Date,
  hoje: Date,
) {
  const codigoAoFim = projetarCodigoNoDia(motorista.registrosJornada, fimViagemExistente, hoje, motorista.diasTrabalhados)
  return codigoAoFim >= MAX_DIAS_CONSECUTIVOS ? MINIMO_HORAS_ENTRE_FOLGAS : MINIMO_HORAS_ENTRE_JORNADAS
}

const HORA_MS = 60 * 60 * 1000
const diaHora = (data: Date) =>
  new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })
    .format(data)
    .replace(",", "")

/**
 * Por que o motorista NÃO está livre pra este período (null = livre): outra
 * viagem no meio, ou descanso (11h, ou 35h depois do 6º dia) que ainda não
 * acabou — antes ou depois desta viagem. Aparece no seletor ao lado do nome
 * (bolinha laranja). Fonte única: motoristaEstaDisponivelNoPeriodo é
 * `motivoIndisponivel(...) === null`.
 */
export function motivoIndisponivel(motorista: MotoristaComAgenda, inicioViagem: Date, fimViagem: Date, hoje: Date): string | null {
  for (const viagem of motorista.viagens) {
    if (!viagemBloqueiaAgenda(viagem) || viagemDesmentidaPeloRelatorio(motorista, viagem)) continue

    const inicioExistente = new Date(viagem.inicioPrevisto)
    const fimExistente = fimEfetivoViagem(viagem)
    const minimoHoras = descansoMinimoNecessarioApos(motorista, fimExistente, hoje)
    if (!periodosConflitamComDescanso(inicioExistente, fimExistente, inicioViagem, fimViagem, minimoHoras)) continue

    const horas = minimoHoras === MINIMO_HORAS_ENTRE_FOLGAS ? ` (${MINIMO_HORAS_ENTRE_FOLGAS}h após o 6º dia)` : ""
    if (periodoConflita(inicioExistente, fimExistente, inicioViagem, fimViagem)) {
      return inicioExistente <= inicioViagem ? `Em viagem até ${diaHora(fimExistente)}` : `Outra viagem às ${diaHora(inicioExistente)}`
    }
    return inicioExistente <= inicioViagem
      ? `Descanso até ${diaHora(new Date(fimExistente.getTime() + minimoHoras * HORA_MS))}${horas}`
      : `Viagem às ${diaHora(inicioExistente)} sem ${minimoHoras}h de descanso depois desta`
  }
  return null
}

export function motoristaEstaDisponivelNoPeriodo(
  motorista: MotoristaComAgenda,
  inicioViagem: Date,
  fimViagem: Date,
  hoje: Date,
) {
  return motivoIndisponivel(motorista, inicioViagem, fimViagem, hoje) === null
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
