import type { StatusIntegracao, StatusViagem, TipoProduto } from "@prisma/client"
import { inicioDoDia } from "@/lib/utils/date-format"
import { fimEfetivoViagem } from "@/lib/services/alocacao/disponibilidade"
import { viagensCompartilhamFrota } from "@/lib/services/frota-regras"

const UM_DIA_MS = 24 * 60 * 60 * 1000
const UM_MINUTO_MS = 60_000

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

export type IntegracaoVencendo = IntegracaoParaRelatorio & {
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

/** Saída até 15 min depois do previsto conta como no horário. */
export const TOLERANCIA_SAIDA_MINUTOS = 15

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

export type SaidaAtrasada = {
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

export type ResultadoPontualidade = {
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

export function analisarPontualidade(
  viagens: ViagemPontualidade[],
  toleranciaMinutos = TOLERANCIA_SAIDA_MINUTOS,
): ResultadoPontualidade {
  const comSaida = viagens.filter((viagem) => viagem.horarioRealSaida !== null)
  const semRegistro = viagens.filter((viagem) => viagem.horarioRealSaida === null && STATUS_JA_SAIU.includes(viagem.status)).length

  const avaliadas = comSaida.map((viagem) => {
    const atrasoMinutos = Math.round((viagem.horarioRealSaida!.getTime() - viagem.inicioPrevisto.getTime()) / UM_MINUTO_MS)
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

export type AvisosDaViagem = {
  avisoInterjornada: string | null
  avisoFrotaIndisponivel: string | null
  avisoFrotaProdutoIncompativel: string | null
  avisoRelatorioJornada: string | null
}

export type AvisoListado = { rotulo: string; detalhe: string }

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
// 7. Uso da frota
// ---------------------------------------------------------------------------

export type FrotaParaUso = {
  id: number
  cavalo: string
  carreta: string
  emManutencao: boolean
  tipoProduto: TipoProduto | null
}

export type ViagemParaUso = {
  id: number
  carreta: string
  status: StatusViagem
  inicioPrevisto: Date
  fimPrevisto: Date
  finalizadoEm: Date | null
}

export type UsoFrota = FrotaParaUso & {
  viagens: number
  diasOcupados: number
  ocupacao: number
  ultimaViagem: Date | null
}

/**
 * Por conjunto: quantas viagens fez no período e quantos dias de calendário
 * ficou em viagem (do início ao fim efetivo, recortado ao período). A
 * carreta identifica o conjunto, mesmo critério do aviso de frota
 * indisponível. Parados primeiro — é o que a operação quer achar.
 */
export function usoDaFrota(
  frotas: FrotaParaUso[],
  viagens: ViagemParaUso[],
  de: Date,
  ate: Date,
  /** Última viagem de cada carreta em qualquer data (até o fim do período) — pra conjunto parado dizer desde quando. */
  ultimaViagemPorCarreta: Map<string, Date> = new Map(),
): UsoFrota[] {
  const inicioPeriodo = inicioDoDia(de).getTime()
  const fimPeriodo = inicioDoDia(ate).getTime()
  const diasPeriodo = Math.round((fimPeriodo - inicioPeriodo) / UM_DIA_MS) + 1

  return frotas
    .map((frota) => {
      const daFrota = viagens.filter(
        (viagem) => viagem.status !== "CANCELADA" && viagensCompartilhamFrota(viagem.carreta, frota.carreta),
      )
      const dias = new Set<number>()
      for (const viagem of daFrota) {
        const inicio = Math.max(inicioDoDia(viagem.inicioPrevisto).getTime(), inicioPeriodo)
        const fim = Math.min(inicioDoDia(fimEfetivoViagem(viagem)).getTime(), fimPeriodo)
        for (let dia = inicio; dia <= fim; dia += UM_DIA_MS) dias.add(inicioDoDia(new Date(dia)).getTime())
      }
      const noPeriodo = daFrota.filter((viagem) => viagem.inicioPrevisto >= de && viagem.inicioPrevisto <= ate)
      const ultima = daFrota.reduce<Date | null>(
        (maisRecente, viagem) => (!maisRecente || viagem.inicioPrevisto > maisRecente ? viagem.inicioPrevisto : maisRecente),
        null,
      )
      return {
        ...frota,
        viagens: noPeriodo.length,
        diasOcupados: dias.size,
        ocupacao: diasPeriodo > 0 ? dias.size / diasPeriodo : 0,
        ultimaViagem: ultimaViagemPorCarreta.get(frota.carreta) ?? ultima,
      }
    })
    .sort((a, b) => a.ocupacao - b.ocupacao || a.carreta.localeCompare(b.carreta, "pt-BR"))
}
