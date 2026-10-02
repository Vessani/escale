import { formatarHoraLocal } from "@/lib/utils/date-format"

const formatoDia = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit" })
const formatoSemana = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", weekday: "short" })

/** "Hoje 07:00", "Amanhã 18:30", "qui 03/10 06:00" — horário de Brasília. */
export function quando(valor: Date | string, agora = new Date()): string {
  const data = new Date(valor)
  const dia = formatoDia.format(data)
  const hoje = formatoDia.format(agora)
  const amanha = formatoDia.format(new Date(agora.getTime() + 24 * 60 * 60 * 1000))
  const rotulo = dia === hoje ? "Hoje" : dia === amanha ? "Amanhã" : `${formatoSemana.format(data).replace(".", "")} ${dia}`
  return `${rotulo} ${formatarHoraLocal(data)}`
}

/** Cidades das entregas em ordem, sem repetir seguidas: "Joinville → Blumenau → Itajaí". */
export function rota(entregas: Array<{ cidade: string }>): string {
  const cidades = entregas.map((entrega) => entrega.cidade.trim()).filter((cidade, i, todas) => cidade && cidade !== todas[i - 1])
  return cidades.join(" → ") || "—"
}
