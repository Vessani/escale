import type { PeriodoPadrao } from "./periodo"
import { HORAS_ESTOURO_JORNADA_PADRAO } from "@/lib/services/relatorios/jornada-analise"
import { DIAS_INTEGRACAO_PADRAO } from "@/lib/services/relatorios/operacao"

/** Período padrão de cada relatório (quando a URL não traz ?de/?ate). */
export const PERIODO_PADRAO = {
  circadiano: { diasAntes: 7, diasDepois: 7 },
  estouroSetimoDia: { diasAntes: 30, diasDepois: 0 },
  quebraIntersticio: { diasAntes: 30, diasDepois: 0 },
  estouroJornada: { diasAntes: 30, diasDepois: 0 },
  motoristas: "MES_ATUAL",
  pontualidade: { diasAntes: 30, diasDepois: 0 },
  avisos: { diasAntes: 30, diasDepois: 0 },
  frota: { diasAntes: 30, diasDepois: 0 },
} satisfies Record<string, PeriodoPadrao>

export const OPCOES_HORAS_ESTOURO_JORNADA = [10, 11, 12, 13, 14] as const
export const OPCOES_DIAS_INTEGRACAO = [15, 30, 60, 90] as const

function inteiroEntre<T extends readonly number[]>(texto: string | null | undefined, opcoes: T, padrao: T[number]): T[number] {
  const valor = Number(texto)
  return (opcoes as readonly number[]).includes(valor) ? (valor as T[number]) : padrao
}

/** ?horas= do relatório de estouro de jornada — só aceita as opções da tela. */
export function parseHorasEstouroJornada(texto: string | null | undefined): number {
  return inteiroEntre(texto, OPCOES_HORAS_ESTOURO_JORNADA, HORAS_ESTOURO_JORNADA_PADRAO as 12)
}

/** ?dias= do relatório de integrações. */
export function parseDiasIntegracao(texto: string | null | undefined): number {
  return inteiroEntre(texto, OPCOES_DIAS_INTEGRACAO, DIAS_INTEGRACAO_PADRAO as 30)
}
