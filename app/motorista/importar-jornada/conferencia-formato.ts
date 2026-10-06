import type { EdicoesJornada, LinhaRevisaoJornada } from "@/lib/parsers/jornada-relatorio-parser"
import { MAX_DIAS_SEM_FOLGA, folgaEstourada } from "@/lib/services/dias-sem-folga"
import { formatarHoraLocal, formatDateTimeForInput } from "@/lib/utils/date-format"
import type { CategoriaLinha } from "./categoria-linha"

/** Textos e regras puras da conferência do Relatório de Jornada (sem React). */

export type Rascunho = { id: number; inicio: string; fim: string; dias: string; erro: string }

export const ROTULO_SITUACAO: Record<LinhaRevisaoJornada["situacao"], string> = {
  IMPORTAR: "Importada",
  MESMO_DIA: "Fora do calendário",
  IGNORADA: "Excluída",
  ABSORVIDA: "Batida extra desconsiderada",
}

/** Ordem das cores na legenda. */
export const LEGENDA: Array<Exclude<CategoriaLinha, "OK">> = ["SETIMO_DIA", "SEM_PAR", "CORRIGIDA", "EDITADA", "FORA"]

export const ROTULO_LEGENDA: Record<Exclude<CategoriaLinha, "OK">, string> = {
  SETIMO_DIA: "7º dia",
  SEM_PAR: "Batida sem par",
  CORRIGIDA: "Corrigida pelo sistema",
  EDITADA: "Alterada por você",
  FORA: "Não entra no calendário",
}

const formatoDia = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", weekday: "long" })

/** "01/09 · terça-feira" */
export function rotuloDia(diaIso: string) {
  const partes = Object.fromEntries(formatoDia.formatToParts(new Date(diaIso)).map((parte) => [parte.type, parte.value]))
  return `${partes.day}/${partes.month} · ${partes.weekday}`
}

/** "01/09 ter" — dia da coluna, com o dia da semana curto. */
export function diaCurto(diaIso: string) {
  const [data, semana] = rotuloDia(diaIso).split(" · ")
  return { data, semana: semana.slice(0, 3) }
}

/** Data em Brasília (YYYY-MM-DD), pra saber se o fim caiu em outro dia. */
const dataLocal = (valor: string) => formatDateTimeForInput(valor).slice(0, 10)

export function diasEntre(de: string, ate: string) {
  return Math.round((Date.parse(dataLocal(ate)) - Date.parse(dataLocal(de))) / 86_400_000)
}

/** Por que a linha tem essa cor — vai no tooltip, não na tela. */
export function motivo(linha: LinhaRevisaoJornada): string {
  const partes: string[] = []
  if (linha.situacao === "MESMO_DIA") partes.push("Não entra no calendário: já tem outra jornada mais tarde nesse dia")
  if (linha.situacao === "ABSORVIDA") partes.push("Batida logo depois da jornada — desconsiderada, não conta como dia")
  if (linha.situacao === "IGNORADA") partes.push("Excluída por você")
  if (linha.correcao === "BATIDAS_UNIDAS") partes.push("Entrada e saída vieram em linhas separadas e foram juntadas")
  if (linha.correcao === "BATIDA_EXTRA") partes.push(`Batida das ${linha.batidaExtra} desconsiderada`)
  if (linha.correcao === "BATIDA_SEM_PAR") partes.push("Batida sem par — o fim pode não ser o real")
  if (linha.situacao === "IMPORTAR" && folgaEstourada(linha.diasSemFolga)) partes.push(`Passou de ${MAX_DIAS_SEM_FOLGA} dias sem folga`)
  if (linha.situacao !== "IGNORADA" && linha.diasSemFolga !== linha.diasSemFolgaRelatorio) {
    partes.push(`Dias sem folga no relatório: ${linha.diasSemFolgaRelatorio}`)
  }
  if (linha.editada && linha.situacao !== "IGNORADA") {
    partes.push(`Alterada por você (era ${formatarHoraLocal(linha.original.inicio)}–${formatarHoraLocal(linha.original.fim)})`)
  }
  return partes.join(" · ")
}

/** Tira do conjunto de edições tudo o que vale pras linhas do arquivo `ids` (e o ajuste de dias da linha `id`). */
export function semEdicoesDe(edicoes: EdicoesJornada, id: number, ids: number[]): EdicoesJornada {
  const remover = new Set(ids)
  const horarios = { ...edicoes.horarios }
  for (const chave of ids) delete horarios[chave]
  const dias = { ...edicoes.dias }
  delete dias[id]
  return {
    ignoradas: edicoes.ignoradas.filter((chave) => !remover.has(chave)),
    semCorrecao: edicoes.semCorrecao.filter((chave) => !remover.has(chave)),
    horarios,
    dias,
  }
}
