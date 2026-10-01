import { formatarDataHoraPtBr, formatarHoraLocal } from "@/lib/utils/date-format"

/** "29/09" */
export function formatarDiaCurto(data: Date | string): string {
  return formatarDataHoraPtBr(data).slice(0, 5)
}

/** "29/09/2026" */
export function formatarDiaCompleto(data: Date | string): string {
  return formatarDataHoraPtBr(data).slice(0, 10)
}

/** "18:40" se cai no mesmo dia de `referencia`, senão "30/09 06:02". */
export function formatarHorarioRelativo(instante: Date | string, referencia: Date | string): string {
  return formatarDiaCurto(instante) === formatarDiaCurto(referencia)
    ? formatarHoraLocal(instante)
    : `${formatarDiaCurto(instante)} ${formatarHoraLocal(instante)}`
}

/** 45 → "45 min", 60 → "1h", 680 → "11h20". */
export function formatarDuracao(minutos: number): string {
  const sinal = minutos < 0 ? "-" : ""
  const total = Math.abs(Math.round(minutos))
  const horas = Math.floor(total / 60)
  const resto = total % 60
  if (horas === 0) return `${sinal}${resto} min`
  return `${sinal}${resto === 0 ? `${horas}h` : `${horas}h${String(resto).padStart(2, "0")}`}`
}

export function formatarPercentual(valor: number): string {
  return `${Math.round(valor * 100)}%`
}

export function rotuloTurno(turno: string): string {
  return turno === "NOITE" ? "Noite" : "Dia"
}

/** Durações longas em dias: 4130 min → "2d 20h50"; abaixo de 1 dia, igual a formatarDuracao. */
export function formatarDuracaoLonga(minutos: number): string {
  const total = Math.round(minutos)
  if (total < 24 * 60) return formatarDuracao(total)
  const dias = Math.floor(total / (24 * 60))
  const resto = total - dias * 24 * 60
  return resto === 0 ? `${dias}d` : `${dias}d ${formatarDuracao(resto)}`
}
