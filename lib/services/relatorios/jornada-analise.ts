import type { MotivoEstouro, TipoMotorista, Turno } from "@prisma/client"
import { inicioDoDia } from "@/lib/utils/date-format"
import { MAX_DIAS_SEM_FOLGA, folgaEstourada } from "@/lib/services/dias-sem-folga"
import { MINIMO_HORAS_ENTRE_FOLGAS, MINIMO_HORAS_ENTRE_JORNADAS } from "@/lib/services/alocacao/disponibilidade"
import { ocorrenciasRealizadas, viagemDaJornada, type ViagemCircadiano } from "@/lib/services/circadiano.service"

/**
 * Análises sobre o que o Relatório de Jornada mostra que ACONTECEU (horários
 * reais), não sobre o planejado no Escale — base dos relatórios de
 * quebra de interstício, estouro de 7º dia, estouro de jornada, ciclo de
 * 72h e do painel por motorista.
 */

/** Limite padrão do relatório de estouro de jornada. */
export const HORAS_ESTOURO_JORNADA_PADRAO = 12

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
// Pares de jornadas seguidas (base dos dois relatórios de descanso)
// ---------------------------------------------------------------------------

type ParDeJornadas = {
  motorista: MotoristaJornada
  anterior: JornadaReal
  seguinte: JornadaReal
  descansoMinutos: number
}

/**
 * Cada jornada do período com a anterior do mesmo motorista. Conta pela
 * jornada SEGUINTE dentro do período. Intervalo negativo (relatório com
 * horários sobrepostos) é ignorado.
 */
function paresDeJornadas(motoristas: MotoristaJornada[], jornadas: JornadaReal[], de: Date, ate: Date): ParDeJornadas[] {
  const porId = new Map(motoristas.map((motorista) => [motorista.id, motorista]))
  const pares: ParDeJornadas[] = []
  for (const [motoristaId, lista] of porMotorista(jornadas)) {
    const motorista = porId.get(motoristaId)
    if (!motorista) continue
    for (let i = 1; i < lista.length; i++) {
      const anterior = lista[i - 1]
      const seguinte = lista[i]
      if (!dentro(seguinte.inicioJornada, de, ate)) continue
      const descansoMinutos = minutosEntre(anterior.fimJornada, seguinte.inicioJornada)
      if (descansoMinutos >= 0) pares.push({ motorista, anterior, seguinte, descansoMinutos })
    }
  }
  return pares
}

// ---------------------------------------------------------------------------
// 1. Quebra de interstício (11h)
// ---------------------------------------------------------------------------

type QuebraIntersticio = {
  motoristaId: number
  motorista: string
  turno: Turno
  fimAnterior: Date
  inicioSeguinte: Date
  descansoMinutos: number
  faltaramMinutos: number
} & DadosDaViagem

/**
 * Motorista que voltou a trabalhar antes de 11h de descanso, pelo relatório
 * de jornada — qualquer dia do ciclo. A folga semanal de 35h depois do 6º
 * dia é outra regra e fica no Estouro de 7º dia (ver folgasSemanaisCurtas).
 */
export function quebrasDeIntersticio(
  motoristas: MotoristaJornada[],
  jornadas: JornadaReal[],
  viagens: ViagemCircadiano[],
  de: Date,
  ate: Date,
): QuebraIntersticio[] {
  const minimo = MINIMO_HORAS_ENTRE_JORNADAS * 60
  return paresDeJornadas(motoristas, jornadas, de, ate)
    .filter((par) => par.descansoMinutos < minimo)
    .map(({ motorista, anterior, seguinte, descansoMinutos }) => ({
      motoristaId: motorista.id,
      motorista: motorista.nome,
      turno: motorista.turno,
      fimAnterior: anterior.fimJornada,
      inicioSeguinte: seguinte.inicioJornada,
      descansoMinutos,
      faltaramMinutos: minimo - descansoMinutos,
      ...dadosDaViagem(viagens, motorista.id, seguinte.inicioJornada, seguinte.fimJornada),
    }))
    .sort((a, b) => b.inicioSeguinte.getTime() - a.inicioSeguinte.getTime())
}

// ---------------------------------------------------------------------------
// 2. Estouro de 7º dia: trabalhou o 7º dia seguido OU a folga depois do 6º
//    dia foi menor que 35h
// ---------------------------------------------------------------------------

/** 7º dia seguido (ou mais) trabalhado, como o relatório de jornada registra. */
export type SetimoDiaTrabalhado = {
  motoristaId: number
  motorista: string
  turno: Turno
  dia: Date
  diasSemFolga: number
  inicio: Date | null
  fim: Date | null
} & DadosDaViagem

type FolgaSemanalCurta = {
  motoristaId: number
  motorista: string
  turno: Turno
  fimAnterior: Date
  inicioSeguinte: Date
  fimSeguinte: Date
  folgaMinutos: number
  faltaramMinutos: number
} & DadosDaViagem

/**
 * Depois do 6º dia seguido, a folga tem que ter 35h. Se a jornada seguinte
 * já é o 7º dia sem folga, ela entra como "7º dia trabalhado" — não repete
 * aqui, é o mesmo fato.
 */
export function folgasSemanaisCurtas(
  motoristas: MotoristaJornada[],
  jornadas: JornadaReal[],
  viagens: ViagemCircadiano[],
  de: Date,
  ate: Date,
): FolgaSemanalCurta[] {
  const minimo = MINIMO_HORAS_ENTRE_FOLGAS * 60
  return paresDeJornadas(motoristas, jornadas, de, ate)
    .filter(
      ({ anterior, seguinte, descansoMinutos }) =>
        diaDoCiclo(anterior) >= MAX_DIAS_SEM_FOLGA && !folgaEstourada(seguinte.diasSemFolga) && descansoMinutos < minimo,
    )
    .map(({ motorista, anterior, seguinte, descansoMinutos }) => ({
      motoristaId: motorista.id,
      motorista: motorista.nome,
      turno: motorista.turno,
      fimAnterior: anterior.fimJornada,
      inicioSeguinte: seguinte.inicioJornada,
      fimSeguinte: seguinte.fimJornada,
      folgaMinutos: descansoMinutos,
      faltaramMinutos: minimo - descansoMinutos,
      ...dadosDaViagem(viagens, motorista.id, seguinte.inicioJornada, seguinte.fimJornada),
    }))
}

export type EstouroSetimoDia = {
  motoristaId: number
  motorista: string
  turno: Turno
  dia: Date
  tipo: "SETIMO_DIA" | "FOLGA_CURTA"
  /** SETIMO_DIA: em que dia seguido estava (7, 8...). */
  diasSemFolga: number | null
  /** Jornada em que o estouro aconteceu. */
  inicio: Date | null
  fim: Date | null
  /** FOLGA_CURTA: quando parou no 6º dia, quanto folgou e quanto faltou pras 35h. */
  fimAnterior: Date | null
  folgaMinutos: number | null
  faltaramMinutos: number | null
} & DadosDaViagem

/** Junta as duas formas de estourar o 7º dia numa lista só, mais recentes primeiro. */
export function juntarEstourosSetimoDia(setimos: SetimoDiaTrabalhado[], folgasCurtas: FolgaSemanalCurta[]): EstouroSetimoDia[] {
  const vazio = { fimAnterior: null, folgaMinutos: null, faltaramMinutos: null }
  return [
    ...setimos.map((item): EstouroSetimoDia => ({ ...item, ...vazio, tipo: "SETIMO_DIA" })),
    ...folgasCurtas.map((item): EstouroSetimoDia => ({
      motoristaId: item.motoristaId,
      motorista: item.motorista,
      turno: item.turno,
      dia: inicioDoDia(item.inicioSeguinte),
      tipo: "FOLGA_CURTA",
      diasSemFolga: null,
      inicio: item.inicioSeguinte,
      fim: item.fimSeguinte,
      fimAnterior: item.fimAnterior,
      folgaMinutos: item.folgaMinutos,
      faltaramMinutos: item.faltaramMinutos,
      atividade: item.atividade,
      numViagem: item.numViagem,
      cavalo: item.cavalo,
      carreta: item.carreta,
    })),
  ].sort((a, b) => b.dia.getTime() - a.dia.getTime() || (b.inicio?.getTime() ?? 0) - (a.inicio?.getTime() ?? 0))
}

// ---------------------------------------------------------------------------
// Autorizações: o pedido de estouro aprovado pelo gestor (link do grupo)
// ---------------------------------------------------------------------------

/** Pedido de estouro APROVADO (ver EstouroJornada) — quem autorizou o estouro da jornada. */
export type AutorizacaoEstouro = {
  id: number
  motoristaId: number
  criadoEm: Date
  decididoEm: Date | null
  decididoPorNome: string | null
  minutosExtras: number
  motivos: MotivoEstouro[]
  pedidoPeloMotorista: boolean
}

/** Pedido feito no descanso, antes de a jornada começar, vale pra jornada que começa até esse tanto depois. */
export const HORAS_ANTECEDENCIA_AUTORIZACAO = 12

const chaveJornada = (motoristaId: number, inicio: Date) => `${motoristaId}-${inicio.getTime()}`

/**
 * Liga cada pedido aprovado a UMA jornada do motorista: a que estava em
 * andamento quando ele foi pedido, ou, se foi pedido antes de começar, a
 * próxima que começa em até HORAS_ANTECEDENCIA_AUTORIZACAO. Não usa a viagem
 * do pedido: numa viagem de vários dias, isso marcaria todos os dias como
 * autorizados. Devolve jornada (motorista + início) → pedidos.
 */
function autorizacoesPorJornada(jornadas: JornadaReal[], autorizacoes: AutorizacaoEstouro[]): Map<string, AutorizacaoEstouro[]> {
  const mapa = new Map<string, AutorizacaoEstouro[]>()
  const jornadasDoMotorista = porMotorista(jornadas)
  const antecedencia = HORAS_ANTECEDENCIA_AUTORIZACAO * 60 * UM_MINUTO_MS

  for (const pedido of autorizacoes) {
    const lista = jornadasDoMotorista.get(pedido.motoristaId) ?? []
    const instante = pedido.criadoEm.getTime()
    const jornada =
      lista.find((j) => j.inicioJornada.getTime() <= instante && instante <= j.fimJornada.getTime()) ??
      lista.find((j) => j.inicioJornada.getTime() > instante && j.inicioJornada.getTime() - instante <= antecedencia)
    if (!jornada) continue
    const chave = chaveJornada(jornada.motoristaId, jornada.inicioJornada)
    mapa.set(chave, [...(mapa.get(chave) ?? []), pedido])
  }
  return mapa
}

// ---------------------------------------------------------------------------
// 3. Estouro de jornada
// ---------------------------------------------------------------------------

type EstouroJornada = {
  motoristaId: number
  motorista: string
  turno: Turno
  inicio: Date
  fim: Date
  duracaoMinutos: number
  excedenteMinutos: number
  /** Pedidos de estouro aprovados pra essa jornada (vazio = sem autorização). */
  autorizacoes: AutorizacaoEstouro[]
} & DadosDaViagem

/** Jornadas reais que passaram do limite de horas escolhido, com quem autorizou (se alguém autorizou). */
export function estourosDeJornada(
  motoristas: MotoristaJornada[],
  jornadas: JornadaReal[],
  viagens: ViagemCircadiano[],
  de: Date,
  ate: Date,
  limiteHoras = HORAS_ESTOURO_JORNADA_PADRAO,
  autorizacoes: AutorizacaoEstouro[] = [],
): EstouroJornada[] {
  const porId = new Map(motoristas.map((motorista) => [motorista.id, motorista]))
  const autorizadas = autorizacoesPorJornada(jornadas, autorizacoes)
  const ocorrencias: EstouroJornada[] = []

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
      autorizacoes: autorizadas.get(chaveJornada(motorista.id, jornada.inicioJornada)) ?? [],
      ...dadosDaViagem(viagens, motorista.id, jornada.inicioJornada, jornada.fimJornada),
    })
  }

  return ocorrencias.sort((a, b) => b.inicio.getTime() - a.inicio.getTime())
}

// ---------------------------------------------------------------------------
// 3b. Ciclo de 72h (horas trabalhadas até a folga de 35h)
// ---------------------------------------------------------------------------

/**
 * Teto de horas trabalhadas entre duas folgas de 35h: 6 dias de 12h. A soma
 * é das jornadas (início→fim de cada uma), sem os descansos entre elas.
 */
export const HORAS_LIMITE_CICLO = 72

/** A partir de quanto o motorista entra no relatório como "perto das 72h". */
export const HORAS_ALERTA_CICLO_PADRAO = 60

type CicloDeTrabalho = {
  motoristaId: number
  motorista: string
  turno: Turno
  /** Primeira jornada depois da última folga de 35h. */
  inicio: Date
  /** Fim da última jornada do ciclo (até onde o relatório de jornada cobre). */
  fim: Date
  jornadas: number
  horasMinutos: number
  /** Quanto falta pras 72h (0 se já passou). */
  faltamMinutos: number
  /** Quanto passou das 72h (0 se não passou). */
  excedenteMinutos: number
  /** Quando a soma passou das 72h (no meio da jornada em que passou); null se não passou. */
  passouEm: Date | null
  /** true = já houve a folga de 35h depois (ciclo encerrado); false = o motorista segue no ciclo. */
  encerrado: boolean
  /** Estouros de jornada aprovados pelo gestor dentro do ciclo. */
  autorizacoes: AutorizacaoEstouro[]
} & DadosDaViagem

/**
 * Ciclos de trabalho (entre folgas de 35h) que chegaram perto das 72h
 * trabalhadas. O ciclo começa na primeira jornada depois de um descanso de
 * 35h ou mais — folga menor que 35h não zera a conta. `coberturaAte`: até que
 * dia o relatório de jornada importado vai; sem jornada depois, o ciclo só
 * conta como encerrado se as 35h de folga já couberem até lá. Ciclo que
 * cruza o período entra inteiro. Os mais carregados primeiro.
 */
export function ciclosDe72h(
  motoristas: MotoristaJornada[],
  jornadas: JornadaReal[],
  viagens: ViagemCircadiano[],
  de: Date,
  ate: Date,
  {
    alertaHoras = HORAS_ALERTA_CICLO_PADRAO,
    autorizacoes = [],
    coberturaAte = null,
  }: { alertaHoras?: number; autorizacoes?: AutorizacaoEstouro[]; coberturaAte?: Date | null } = {},
): CicloDeTrabalho[] {
  const porId = new Map(motoristas.map((motorista) => [motorista.id, motorista]))
  const autorizadas = autorizacoesPorJornada(jornadas, autorizacoes)
  const folgaMs = MINIMO_HORAS_ENTRE_FOLGAS * 60 * UM_MINUTO_MS
  const limite = HORAS_LIMITE_CICLO * 60
  // Fim do último dia coberto pelo relatório de jornada.
  const fimDaCobertura = coberturaAte ? coberturaAte.getTime() + 24 * 60 * 60 * 1000 : null
  const ciclos: CicloDeTrabalho[] = []

  for (const [motoristaId, lista] of porMotorista(jornadas)) {
    const motorista = porId.get(motoristaId)
    if (!motorista) continue

    // Fatia as jornadas em ciclos: um descanso de 35h+ fecha o anterior.
    const grupos: JornadaReal[][] = []
    for (const jornada of lista) {
      const atual = grupos.at(-1)
      const ultima = atual?.at(-1)
      if (atual && ultima && jornada.inicioJornada.getTime() - ultima.fimJornada.getTime() < folgaMs) atual.push(jornada)
      else grupos.push([jornada])
    }

    grupos.forEach((grupo, indice) => {
      const primeira = grupo[0]
      const ultima = grupo[grupo.length - 1]
      if (primeira.inicioJornada > ate || ultima.fimJornada < de) return

      let horasMinutos = 0
      let passouEm: Date | null = null
      for (const jornada of grupo) {
        const duracao = Math.max(0, minutosEntre(jornada.inicioJornada, jornada.fimJornada))
        if (passouEm === null && horasMinutos + duracao > limite) {
          passouEm = new Date(jornada.inicioJornada.getTime() + (limite - horasMinutos) * UM_MINUTO_MS)
        }
        horasMinutos += duracao
      }
      if (horasMinutos < alertaHoras * 60) return

      const temProximo = indice < grupos.length - 1
      const folgaJaCabe = fimDaCobertura !== null && fimDaCobertura - ultima.fimJornada.getTime() >= folgaMs
      ciclos.push({
        motoristaId: motorista.id,
        motorista: motorista.nome,
        turno: motorista.turno,
        inicio: primeira.inicioJornada,
        fim: ultima.fimJornada,
        jornadas: grupo.length,
        horasMinutos,
        faltamMinutos: Math.max(0, limite - horasMinutos),
        excedenteMinutos: Math.max(0, horasMinutos - limite),
        passouEm,
        encerrado: temProximo || folgaJaCabe,
        autorizacoes: grupo.flatMap((j) => autorizadas.get(chaveJornada(motorista.id, j.inicioJornada)) ?? []),
        // O que fazia na última jornada do ciclo.
        ...dadosDaViagem(viagens, motorista.id, ultima.inicioJornada, ultima.fimJornada),
      })
    })
  }

  return ciclos.sort((a, b) => b.horasMinutos - a.horasMinutos || b.fim.getTime() - a.fim.getTime())
}

// ---------------------------------------------------------------------------
// 4. Painel por motorista
// ---------------------------------------------------------------------------

type LinhaPainelMotorista = {
  motoristaId: number
  motorista: string
  turno: Turno
  tipo: TipoMotorista
  diasTrabalhados: number
  horasTrabalhadasMinutos: number
  maiorJornadaMinutos: number
  viagens: number
  circadiano: number
  estourosSetimoDia: number
  quebrasIntersticio: number
  estourosJornada: number
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
  const intersticio = contar(quebrasDeIntersticio(motoristas, jornadas, viagens, de, ate))
  const estourosJornada = contar(estourosDeJornada(motoristas, jornadas, viagens, de, ate))
  const setimoDia = contar([
    ...noPeriodo.filter((jornada) => folgaEstourada(jornada.diasSemFolga)),
    ...folgasSemanaisCurtas(motoristas, jornadas, viagens, de, ate),
  ])
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
        estourosSetimoDia: setimoDia.get(motorista.id) ?? 0,
        quebrasIntersticio: intersticio.get(motorista.id) ?? 0,
        estourosJornada: estourosJornada.get(motorista.id) ?? 0,
      }
      return {
        ...linha,
        totalAlertas: linha.circadiano + linha.estourosSetimoDia + linha.quebrasIntersticio + linha.estourosJornada,
      }
    })
    .sort(
      (a, b) =>
        b.totalAlertas - a.totalAlertas ||
        b.horasTrabalhadasMinutos - a.horasTrabalhadasMinutos ||
        a.motorista.localeCompare(b.motorista, "pt-BR"),
    )
}
