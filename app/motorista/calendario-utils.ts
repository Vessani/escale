import {
  CODIGO_EXAMES,
  CODIGO_FERIAS,
  CODIGO_FOLGA,
  CODIGO_INTERNO,
  CODIGO_MANUTENCAO,
  ROTULO_CODIGO_PARADO,
} from "@/lib/services/codigo-jornada"
import { MAX_DIAS_SEM_FOLGA } from "@/lib/services/dias-sem-folga"
import { parseDataLocal } from "@/lib/utils/date-format"
import {
  CLASSE_JORNADA_1_3,
  CLASSE_JORNADA_4_5,
  CLASSE_JORNADA_6,
  CLASSE_JORNADA_EXAMES,
  CLASSE_JORNADA_FERIAS,
  CLASSE_JORNADA_FOLGA,
  CLASSE_JORNADA_INTERNO,
  CLASSE_JORNADA_MANUTENCAO,
} from "./jornada-status"

type OpcaoCodigoJornada = {
  valor: number
  label: string
}

export type FiltroStatusJornada =
  "TODOS" | "JORNADA_1_3" | "JORNADA_4_5" | "JORNADA_6" | "FOLGA" | "FERIAS" | "EXAMES" | "INTERNO" | "MANUTENCAO"

export const OPCOES_CODIGO_JORNADA: OpcaoCodigoJornada[] = [
  { valor: 1, label: "1º dia" },
  { valor: 2, label: "2º dia" },
  { valor: 3, label: "3º dia" },
  { valor: 4, label: "4º dia" },
  { valor: 5, label: "5º dia" },
  { valor: 6, label: "6º dia" },
  ...[CODIGO_FOLGA, CODIGO_FERIAS, CODIGO_EXAMES, CODIGO_INTERNO, CODIGO_MANUTENCAO].map((valor) => ({
    valor,
    label: ROTULO_CODIGO_PARADO[valor],
  })),
]

export const OPCOES_FILTRO_STATUS: Array<{ valor: FiltroStatusJornada; label: string; classe: string }> = [
  { valor: "TODOS", label: "Todos", classe: "bg-background text-foreground border border-border" },
  { valor: "JORNADA_1_3", label: "1-3 Jornada", classe: CLASSE_JORNADA_1_3 },
  { valor: "JORNADA_4_5", label: "4-5 Jornada", classe: CLASSE_JORNADA_4_5 },
  { valor: "JORNADA_6", label: "6 Jornada", classe: CLASSE_JORNADA_6 },
  { valor: "FOLGA", label: "7 Folga", classe: CLASSE_JORNADA_FOLGA },
  { valor: "FERIAS", label: "8 Férias", classe: CLASSE_JORNADA_FERIAS },
  { valor: "EXAMES", label: "9 Exames", classe: CLASSE_JORNADA_EXAMES },
  { valor: "INTERNO", label: "10 Interno", classe: CLASSE_JORNADA_INTERNO },
  { valor: "MANUTENCAO", label: "11 Manutenção", classe: CLASSE_JORNADA_MANUTENCAO },
]

const CODIGO_DO_FILTRO: Partial<Record<FiltroStatusJornada, number>> = {
  JORNADA_6: MAX_DIAS_SEM_FOLGA,
  FOLGA: CODIGO_FOLGA,
  FERIAS: CODIGO_FERIAS,
  EXAMES: CODIGO_EXAMES,
  INTERNO: CODIGO_INTERNO,
  MANUTENCAO: CODIGO_MANUTENCAO,
}

export function statusJornadaCorrespondeAoFiltro(codigo: number, filtro: FiltroStatusJornada) {
  if (filtro === "TODOS") {
    return true
  }

  if (filtro === "JORNADA_1_3") {
    return codigo >= 1 && codigo <= 3
  }

  if (filtro === "JORNADA_4_5") {
    return codigo >= 4 && codigo <= 5
  }

  return codigo === CODIGO_DO_FILTRO[filtro]
}

/** Quantidade de dias exibidos de cada vez no calendário (uma "página" de navegação): 3 antes, hoje e 3 depois. */
export const TAMANHO_JANELA_CALENDARIO = 7

/** Dias antes de hoje na janela padrão (sem ?inicio na URL). */
export const DIAS_ANTES_DE_HOJE = 3

/** Lê o parâmetro `inicio` da URL (YYYY-MM-DD); retorna null se ausente/inválido. */
export function parseDataInicioParam(valor?: string) {
  if (!valor) {
    return null
  }

  try {
    return parseDataLocal(valor)
  } catch {
    return null
  }
}

export function formatarDataDia(data: Date) {
  const ano = data.getFullYear()
  const mes = String(data.getMonth() + 1).padStart(2, "0")
  const dia = String(data.getDate()).padStart(2, "0")
  return `${ano}-${mes}-${dia}`
}

/** Gera `tamanho` dias consecutivos a partir de `dataInicio` (inclusive). */
export function gerarJanelaDias(dataInicio: Date, tamanho: number) {
  return Array.from({ length: tamanho }, (_, index) => {
    const dia = new Date(dataInicio)
    dia.setDate(dia.getDate() + index)
    return dia
  })
}

/** Rótulo do intervalo exibido, ex: "09 jul – 07 ago de 2026" (ano só uma vez, quando não muda). */
export function formatarIntervaloDias(inicio: Date, fim: Date) {
  const mesmoAno = inicio.getFullYear() === fim.getFullYear()
  const formatoSemAno = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" })
  const formatoComAno = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", year: "numeric" })

  const inicioTexto = mesmoAno ? formatoSemAno.format(inicio) : formatoComAno.format(inicio)
  return `${inicioTexto} – ${formatoComAno.format(fim)}`
}

export function formatarSemana(data: Date) {
  return new Intl.DateTimeFormat("pt-BR", {
    weekday: "short",
  }).format(data)
}
