import type { StatusIntegracao, StatusViagem, VeiculoManutencao } from "@prisma/client"
import { inicioDoDia } from "@/lib/utils/date-format"
import { fimEfetivoViagem } from "@/lib/services/alocacao/disponibilidade"
import { fimEfetivo, inicioEfetivo, type ManutencaoBase } from "@/lib/services/manutencao-regras"
import { TOLERANCIA_SAIDA_MINUTOS, minutosDeAtraso } from "@/lib/services/pontualidade"

const UM_DIA_MS = 24 * 60 * 60 * 1000

// ---------------------------------------------------------------------------
// 4. Integrações vencendo
// ---------------------------------------------------------------------------

/** Quantos dias pra frente o relatório olha, por padrão. */
export const DIAS_INTEGRACAO_PADRAO = 30
/** Até aqui a linha fica em destaque forte (precisa agir já). */
export const DIAS_INTEGRACAO_URGENTE = 7

export type SituacaoIntegracao = "VENCIDA" | "URGENTE" | "VENCENDO"

export type IntegracaoParaRelatorio = {
  motorista: string
  motoristaId: number
  cliente: string
  status: StatusIntegracao
  /** Já em meia-noite de Brasília (ver colunaDateParaLocal). */
  dataValidade: Date
}

type IntegracaoVencendo = IntegracaoParaRelatorio & {
  situacao: SituacaoIntegracao
  /** Negativo = venceu há N dias. */
  diasParaVencer: number
}

/**
 * Integrações com validade até `dias` dias a partir de hoje (incluindo as
 * já vencidas). Vencidas primeiro, depois por data.
 */
export function integracoesVencendo(
  integracoes: IntegracaoParaRelatorio[],
  hoje: Date,
  dias = DIAS_INTEGRACAO_PADRAO,
): IntegracaoVencendo[] {
  const dia = inicioDoDia(hoje).getTime()

  return integracoes
    .map((integracao) => {
      const diasParaVencer = Math.round((inicioDoDia(integracao.dataValidade).getTime() - dia) / UM_DIA_MS)
      const situacao: SituacaoIntegracao =
        diasParaVencer < 0 ? "VENCIDA" : diasParaVencer <= DIAS_INTEGRACAO_URGENTE ? "URGENTE" : "VENCENDO"
      return { ...integracao, diasParaVencer, situacao }
    })
    .filter((integracao) => integracao.diasParaVencer <= dias)
    .sort((a, b) => a.diasParaVencer - b.diasParaVencer || a.motorista.localeCompare(b.motorista, "pt-BR"))
}

export function textoVencimento(diasParaVencer: number): string {
  if (diasParaVencer < -1) return `Venceu há ${-diasParaVencer} dias`
  if (diasParaVencer === -1) return "Venceu ontem"
  if (diasParaVencer === 0) return "Vence hoje"
  if (diasParaVencer === 1) return "Vence amanhã"
  return `Vence em ${diasParaVencer} dias`
}

// ---------------------------------------------------------------------------
// 5. Pontualidade de saída
// ---------------------------------------------------------------------------

export { TOLERANCIA_SAIDA_MINUTOS } from "@/lib/services/pontualidade"

/** Status em que a viagem já devia ter saída registrada. */
const STATUS_JA_SAIU: StatusViagem[] = ["INICIADA", "RETORNANDO", "FINALIZADA"]

export type ViagemPontualidade = {
  id: number
  numViagem: string
  status: StatusViagem
  inicioPrevisto: Date
  horarioRealSaida: Date | null
  motivoAtraso: string | null
  motorista: { id: number; nome: string } | null
  clientes: string[]
}

type SaidaAtrasada = {
  id: number
  numViagem: string
  motorista: string
  previsto: Date
  real: Date
  atrasoMinutos: number
  motivo: string
  clientes: string[]
}

export type GrupoPontualidade = {
  nome: string
  saidas: number
  atrasadas: number
  percentualNoHorario: number
  atrasoMedioMinutos: number
}

type ResultadoPontualidade = {
  saidasRegistradas: number
  /** Viagens já iniciadas/finalizadas sem horário de saída — o número acima não conta com elas. */
  semRegistro: number
  noHorario: number
  atrasadas: number
  percentualNoHorario: number
  atrasoMedioMinutos: number
  maiorAtrasoMinutos: number
  listaAtrasos: SaidaAtrasada[]
  porMotivo: Array<{ motivo: string; quantidade: number; atrasoMedioMinutos: number }>
  porMotorista: GrupoPontualidade[]
  porCliente: GrupoPontualidade[]
}

export const SEM_MOTIVO = "Sem motivo informado"

function media(valores: number[]): number {
  return valores.length === 0 ? 0 : Math.round(valores.reduce((soma, valor) => soma + valor, 0) / valores.length)
}

function normalizarMotivo(motivo: string | null): string {
  const texto = motivo?.trim().replace(/\s+/g, " ") ?? ""
  if (!texto) return SEM_MOTIVO
  return texto.charAt(0).toUpperCase() + texto.slice(1)
}

export function analisarPontualidade(viagens: ViagemPontualidade[], toleranciaMinutos = TOLERANCIA_SAIDA_MINUTOS): ResultadoPontualidade {
  const comSaida = viagens.filter((viagem) => viagem.horarioRealSaida !== null)
  const semRegistro = viagens.filter((viagem) => viagem.horarioRealSaida === null && STATUS_JA_SAIU.includes(viagem.status)).length

  const avaliadas = comSaida.map((viagem) => {
    const atrasoMinutos = minutosDeAtraso(viagem.inicioPrevisto, viagem.horarioRealSaida!)
    return { viagem, atrasoMinutos, atrasada: atrasoMinutos > toleranciaMinutos }
  })
  const atrasadas = avaliadas.filter((item) => item.atrasada)

  const agrupar = (chaves: (viagem: ViagemPontualidade) => string[]): GrupoPontualidade[] => {
    const grupos = new Map<string, { saidas: number; atrasos: number[] }>()
    for (const { viagem, atrasoMinutos, atrasada } of avaliadas) {
      for (const chave of new Set(chaves(viagem))) {
        const grupo = grupos.get(chave) ?? { saidas: 0, atrasos: [] }
        grupo.saidas++
        if (atrasada) grupo.atrasos.push(atrasoMinutos)
        grupos.set(chave, grupo)
      }
    }
    return [...grupos.entries()]
      .map(([nome, grupo]) => ({
        nome,
        saidas: grupo.saidas,
        atrasadas: grupo.atrasos.length,
        percentualNoHorario: (grupo.saidas - grupo.atrasos.length) / grupo.saidas,
        atrasoMedioMinutos: media(grupo.atrasos),
      }))
      .sort((a, b) => b.atrasadas - a.atrasadas || a.percentualNoHorario - b.percentualNoHorario || a.nome.localeCompare(b.nome, "pt-BR"))
  }

  const motivos = new Map<string, number[]>()
  for (const { viagem, atrasoMinutos } of atrasadas) {
    const motivo = normalizarMotivo(viagem.motivoAtraso)
    motivos.set(motivo, [...(motivos.get(motivo) ?? []), atrasoMinutos])
  }

  return {
    saidasRegistradas: comSaida.length,
    semRegistro,
    noHorario: comSaida.length - atrasadas.length,
    atrasadas: atrasadas.length,
    percentualNoHorario: comSaida.length === 0 ? 0 : (comSaida.length - atrasadas.length) / comSaida.length,
    atrasoMedioMinutos: media(atrasadas.map((item) => item.atrasoMinutos)),
    maiorAtrasoMinutos: atrasadas.length === 0 ? 0 : Math.max(...atrasadas.map((item) => item.atrasoMinutos)),
    listaAtrasos: atrasadas
      .map(({ viagem, atrasoMinutos }) => ({
        id: viagem.id,
        numViagem: viagem.numViagem,
        motorista: viagem.motorista?.nome ?? "Sem motorista",
        previsto: viagem.inicioPrevisto,
        real: viagem.horarioRealSaida!,
        atrasoMinutos,
        motivo: normalizarMotivo(viagem.motivoAtraso),
        clientes: viagem.clientes,
      }))
      .sort((a, b) => b.previsto.getTime() - a.previsto.getTime()),
    porMotivo: [...motivos.entries()]
      .map(([motivo, atrasos]) => ({ motivo, quantidade: atrasos.length, atrasoMedioMinutos: media(atrasos) }))
      .sort((a, b) => b.quantidade - a.quantidade || a.motivo.localeCompare(b.motivo, "pt-BR")),
    porMotorista: agrupar((viagem) => [viagem.motorista?.nome ?? "Sem motorista"]),
    porCliente: agrupar((viagem) => (viagem.clientes.length > 0 ? viagem.clientes : ["Sem cliente"])),
  }
}

// ---------------------------------------------------------------------------
// 6. Viagens que saíram com aviso
// ---------------------------------------------------------------------------

type AvisosDaViagem = {
  avisoInterjornada: string | null
  avisoFrotaIndisponivel: string | null
  avisoFrotaProdutoIncompativel: string | null
  avisoRelatorioJornada: string | null
}

type AvisoListado = { rotulo: string; detalhe: string }

/** Os avisos gravados na viagem, com o rótulo curto que aparece na tela. */
export function listarAvisos(viagem: AvisosDaViagem): AvisoListado[] {
  const avisos: AvisoListado[] = []
  if (viagem.avisoInterjornada) avisos.push({ rotulo: "Descanso", detalhe: viagem.avisoInterjornada })
  if (viagem.avisoFrotaIndisponivel) avisos.push({ rotulo: "Frota indisponível", detalhe: viagem.avisoFrotaIndisponivel })
  if (viagem.avisoFrotaProdutoIncompativel) avisos.push({ rotulo: "Frota de outro produto", detalhe: viagem.avisoFrotaProdutoIncompativel })
  if (viagem.avisoRelatorioJornada) avisos.push({ rotulo: "Não consta no relatório", detalhe: viagem.avisoRelatorioJornada })
  return avisos
}

// ---------------------------------------------------------------------------
// 7. Disponibilidade da frota (por cavalo e por carreta)
// ---------------------------------------------------------------------------

type Intervalo = [number, number]

/** Junta intervalos sobrepostos. */
function unir(intervalos: Intervalo[]): Intervalo[] {
  const ordenados = intervalos.filter(([a, b]) => b > a).sort((x, y) => x[0] - y[0])
  const unidos: Intervalo[] = []
  for (const [inicio, fim] of ordenados) {
    const ultimo = unidos[unidos.length - 1]
    if (ultimo && inicio <= ultimo[1]) ultimo[1] = Math.max(ultimo[1], fim)
    else unidos.push([inicio, fim])
  }
  return unidos
}

function total(intervalos: Intervalo[]): number {
  return intervalos.reduce((soma, [inicio, fim]) => soma + (fim - inicio), 0)
}

/** a − b (partes de `a` que não estão em `b`); ambos já unidos. */
function subtrair(a: Intervalo[], b: Intervalo[]): Intervalo[] {
  const resultado: Intervalo[] = []
  for (const [inicio, fim] of a) {
    let cursor = inicio
    for (const [bi, bf] of b) {
      if (bf <= cursor || bi >= fim) continue
      if (bi > cursor) resultado.push([cursor, bi])
      cursor = Math.max(cursor, bf)
    }
    if (cursor < fim) resultado.push([cursor, fim])
  }
  return resultado
}

function recortar(inicio: number, fim: number, de: number, ate: number): Intervalo {
  return [Math.max(inicio, de), Math.min(fim, ate)]
}

export type VeiculoDisponibilidade = { veiculo: VeiculoManutencao; codigo: string; conjunto: string | null }

export type ViagemDisponibilidade = {
  id: number
  cavalo: string
  carreta: string
  status: StatusViagem
  inicioPrevisto: Date
  fimPrevisto: Date
  finalizadoEm: Date | null
  horarioRealSaida: Date | null
}

export type DisponibilidadeVeiculo = VeiculoDisponibilidade & {
  viagens: number
  minutosPeriodo: number
  minutosEmRota: number
  minutosManutencaoWhiteMartins: number
  minutosManutencaoRitmo: number
  minutosDisponivelParado: number
  /** Fora de manutenção / período. */
  disponibilidade: number
  /** Em rota / período. */
  utilizacao: number
  manutencoes: number
  ultimaViagem: Date | null
}

const MINUTO_MS = 60_000

/**
 * Pra cada cavalo e carreta, como o tempo do período se dividiu: em rota
 * (viagens não canceladas, da saída real — ou do início previsto — até o fim
 * efetivo), parado em manutenção (separado por responsável) e disponível
 * sem uso. Manutenção vence rota se os dois se sobrepõem. Só conta até
 * `agora`: o futuro ainda não aconteceu.
 */
export function disponibilidadeDaFrota(
  veiculos: VeiculoDisponibilidade[],
  viagens: ViagemDisponibilidade[],
  manutencoes: ManutencaoBase[],
  de: Date,
  ate: Date,
  agora: Date,
  ultimaViagemPorVeiculo: Map<string, Date> = new Map(),
): DisponibilidadeVeiculo[] {
  const inicioPeriodo = de.getTime()
  const fimPeriodo = Math.min(ate.getTime(), agora.getTime())
  const minutosPeriodo = Math.max(0, Math.round((fimPeriodo - inicioPeriodo) / MINUTO_MS))

  return veiculos
    .map((veiculo) => {
      const usaVeiculo = (viagem: ViagemDisponibilidade) =>
        viagem.status !== "CANCELADA" &&
        (veiculo.veiculo === "CAVALO" ? viagem.cavalo === veiculo.codigo : viagem.carreta === veiculo.codigo)
      const daFrota = viagens.filter(usaVeiculo)

      const manutencoesDoVeiculo = manutencoes.filter((m) => m.veiculo === veiculo.veiculo && m.codigo === veiculo.codigo)
      const intervaloManutencao = (m: ManutencaoBase) =>
        recortar(inicioEfetivo(m).getTime(), (fimEfetivo(m, agora) ?? agora).getTime(), inicioPeriodo, fimPeriodo)
      const manutencaoWM = unir(manutencoesDoVeiculo.filter((m) => m.responsavel === "WHITE_MARTINS").map(intervaloManutencao))
      const manutencaoRitmo = subtrair(
        unir(manutencoesDoVeiculo.filter((m) => m.responsavel === "RITMO").map(intervaloManutencao)),
        manutencaoWM,
      )
      const parado = unir([...manutencaoWM, ...manutencaoRitmo])

      const rota = subtrair(
        unir(
          daFrota.map((viagem) =>
            recortar(
              (viagem.horarioRealSaida ?? viagem.inicioPrevisto).getTime(),
              fimEfetivoViagem(viagem).getTime(),
              inicioPeriodo,
              fimPeriodo,
            ),
          ),
        ),
        parado,
      )

      const minutosEmRota = Math.round(total(rota) / MINUTO_MS)
      const minutosManutencaoWhiteMartins = Math.round(total(manutencaoWM) / MINUTO_MS)
      const minutosManutencaoRitmo = Math.round(total(manutencaoRitmo) / MINUTO_MS)
      const minutosParados = minutosManutencaoWhiteMartins + minutosManutencaoRitmo
      const ultima = daFrota.reduce<Date | null>(
        (maisRecente, viagem) => (!maisRecente || viagem.inicioPrevisto > maisRecente ? viagem.inicioPrevisto : maisRecente),
        null,
      )

      return {
        ...veiculo,
        viagens: daFrota.filter((v) => v.inicioPrevisto >= de && v.inicioPrevisto <= ate).length,
        minutosPeriodo,
        minutosEmRota,
        minutosManutencaoWhiteMartins,
        minutosManutencaoRitmo,
        minutosDisponivelParado: Math.max(0, minutosPeriodo - minutosEmRota - minutosParados),
        disponibilidade: minutosPeriodo > 0 ? (minutosPeriodo - minutosParados) / minutosPeriodo : 1,
        utilizacao: minutosPeriodo > 0 ? minutosEmRota / minutosPeriodo : 0,
        manutencoes: manutencoesDoVeiculo.filter((m) => {
          const [a, b] = intervaloManutencao(m)
          return b > a
        }).length,
        ultimaViagem: ultimaViagemPorVeiculo.get(`${veiculo.veiculo}:${veiculo.codigo}`) ?? ultima,
      }
    })
    .sort((a, b) => a.disponibilidade - b.disponibilidade || a.utilizacao - b.utilizacao || a.codigo.localeCompare(b.codigo, "pt-BR"))
}
