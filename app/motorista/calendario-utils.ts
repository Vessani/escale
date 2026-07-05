export type OpcaoCodigoJornada = {
  valor: number
  label: string
}

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
