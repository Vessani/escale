export type OpcaoCodigoJornada = {
  valor: number
  label: string
}

export type FiltroStatusJornada =
  | "TODOS"
  | "JORNADA_1_3"
  | "JORNADA_4_5"
  | "JORNADA_6"
  | "FOLGA"
  | "FERIAS"
  | "EXAMES"
  | "INTERNO"

export const OPCOES_CODIGO_JORNADA: OpcaoCodigoJornada[] = [
  { valor: 1, label: "1º dia" },
  { valor: 2, label: "2º dia" },
  { valor: 3, label: "3º dia" },
  { valor: 4, label: "4º dia" },
  { valor: 5, label: "5º dia" },
  { valor: 6, label: "6º dia" },
  { valor: 7, label: "Folga" },
  { valor: 8, label: "Férias" },
  { valor: 9, label: "Exames" },
  { valor: 10, label: "Interno" },
]

export const OPCOES_FILTRO_STATUS: Array<{ valor: FiltroStatusJornada; label: string; classe: string }> = [
  { valor: "TODOS", label: "Todos", classe: "bg-white text-slate-700 border border-slate-200" },
  { valor: "JORNADA_1_3", label: "1-3 Jornada", classe: "bg-emerald-100 text-emerald-800 border border-emerald-200" },
  { valor: "JORNADA_4_5", label: "4-5 Jornada", classe: "bg-yellow-100 text-yellow-800 border border-yellow-200" },
  { valor: "JORNADA_6", label: "6 Jornada", classe: "bg-orange-100 text-orange-800 border border-orange-200" },
  { valor: "FOLGA", label: "7 Folga", classe: "bg-sky-100 text-sky-800 border border-sky-200" },
  { valor: "FERIAS", label: "8 Férias", classe: "bg-indigo-100 text-indigo-800 border border-indigo-200" },
  { valor: "EXAMES", label: "9 Exames", classe: "bg-rose-100 text-rose-800 border border-rose-200" },
  { valor: "INTERNO", label: "10 Interno", classe: "bg-slate-200 text-slate-800 border border-slate-300" },
]

export function statusJornadaCorrespondeAoFiltro(
  diasTrabalhados: number,
  filtro: FiltroStatusJornada,
) {
  if (filtro === "TODOS") {
    return true
  }

  if (filtro === "JORNADA_1_3") {
    return diasTrabalhados >= 1 && diasTrabalhados <= 3
  }

  if (filtro === "JORNADA_4_5") {
    return diasTrabalhados >= 4 && diasTrabalhados <= 5
  }

  if (filtro === "JORNADA_6") {
    return diasTrabalhados === 6
  }

  if (filtro === "FOLGA") {
    return diasTrabalhados === 7
  }

  if (filtro === "FERIAS") {
    return diasTrabalhados === 8
  }

  if (filtro === "EXAMES") {
    return diasTrabalhados === 9
  }

  return diasTrabalhados === 10
}

export function inicioDoDia(data: Date) {
  const dia = new Date(data)
  dia.setHours(0, 0, 0, 0)
  return dia
}

export function fimDoDia(data: Date) {
  const dia = new Date(data)
  dia.setHours(23, 59, 59, 999)
  return dia
}

export function inicioDoMes(data: Date) {
  return inicioDoDia(new Date(data.getFullYear(), data.getMonth(), 1))
}

export function fimDoMes(data: Date) {
  return fimDoDia(new Date(data.getFullYear(), data.getMonth() + 1, 0))
}

export function parseMesParam(valor?: string) {
  if (!valor || !/^\d{4}-\d{2}$/.test(valor)) {
    return null
  }

  const [anoTexto, mesTexto] = valor.split("-")
  const ano = Number(anoTexto)
  const mes = Number(mesTexto)

  if (!Number.isInteger(ano) || !Number.isInteger(mes) || mes < 1 || mes > 12) {
    return null
  }

  return inicioDoMes(new Date(ano, mes - 1, 1))
}

export function formatarMesParam(data: Date) {
  const ano = data.getFullYear()
  const mes = String(data.getMonth() + 1).padStart(2, "0")
  return `${ano}-${mes}`
}

export function formatarMesAno(data: Date) {
  return new Intl.DateTimeFormat("pt-BR", {
    month: "long",
    year: "numeric",
  }).format(data)
}

export function formatarDataDia(data: Date) {
  const ano = data.getFullYear()
  const mes = String(data.getMonth() + 1).padStart(2, "0")
  const dia = String(data.getDate()).padStart(2, "0")
  return `${ano}-${mes}-${dia}`
}

export function gerarDiasDoMes(data: Date) {
  const ano = data.getFullYear()
  const mes = data.getMonth()
  const totalDias = new Date(ano, mes + 1, 0).getDate()

  return Array.from({ length: totalDias }, (_, index) => new Date(ano, mes, index + 1))
}

export function formatarSemana(data: Date) {
  return new Intl.DateTimeFormat("pt-BR", {
    weekday: "short",
  }).format(data)
}
