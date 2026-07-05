const DIAS_NO_CICLO_JORNADA = 7

export type StatusJornada = {
  texto: string
  classe: string
}

function inicioDoDia(data: Date) {
  const dia = new Date(data)
  dia.setHours(0, 0, 0, 0)
  return dia
}

export function diferencaEmDias(dataA: Date, dataB: Date) {
  const inicioA = inicioDoDia(dataA).getTime()
  const inicioB = inicioDoDia(dataB).getTime()
  return Math.round((inicioA - inicioB) / 86_400_000)
}

export function calcularCodigoJornadaNoDia(codigoAtual: number, dia: Date, hoje: Date) {
  if (codigoAtual >= 8 && codigoAtual <= 10) {
    return codigoAtual
  }

  if (codigoAtual < 1 || codigoAtual > DIAS_NO_CICLO_JORNADA) {
    return codigoAtual
  }

  const deslocamento = diferencaEmDias(dia, hoje)
  const base = codigoAtual - 1
  const rotacao = ((base + deslocamento) % DIAS_NO_CICLO_JORNADA + DIAS_NO_CICLO_JORNADA) % DIAS_NO_CICLO_JORNADA
  return rotacao + 1
}

export function calcularCodigoAtualPorCodigoNoDia(codigoNoDia: number, dia: Date, hoje: Date) {
  if (codigoNoDia >= 8 && codigoNoDia <= 10) {
    return codigoNoDia
  }

  if (codigoNoDia < 1 || codigoNoDia > DIAS_NO_CICLO_JORNADA) {
    return codigoNoDia
  }

  const deslocamento = diferencaEmDias(dia, hoje)
  const baseNoDia = codigoNoDia - 1
  const baseAtual = ((baseNoDia - deslocamento) % DIAS_NO_CICLO_JORNADA + DIAS_NO_CICLO_JORNADA) % DIAS_NO_CICLO_JORNADA
  return baseAtual + 1
}

export function obterStatusJornada(diasTrabalhados: number): StatusJornada {
  if (diasTrabalhados >= 1 && diasTrabalhados <= 3) {
    return { texto: `${diasTrabalhados}º dia`, classe: "bg-emerald-100 text-emerald-800 border border-emerald-200" }
  }

  if (diasTrabalhados >= 4 && diasTrabalhados <= 5) {
    return { texto: `${diasTrabalhados}º dia`, classe: "bg-yellow-100 text-yellow-800 border border-yellow-200" }
  }

  if (diasTrabalhados === 6) {
    return { texto: "6º dia", classe: "bg-orange-100 text-orange-800 border border-orange-200" }
  }

  if (diasTrabalhados === 7) {
    return { texto: "Folga", classe: "bg-sky-100 text-sky-800 border border-sky-200" }
  }

  if (diasTrabalhados === 8) {
    return { texto: "Férias", classe: "bg-indigo-100 text-indigo-800 border border-indigo-200" }
  }

  if (diasTrabalhados === 9) {
    return { texto: "Exames", classe: "bg-rose-100 text-rose-800 border border-rose-200" }
  }

  if (diasTrabalhados === 10) {
    return { texto: "Interno", classe: "bg-slate-200 text-slate-800 border border-slate-300" }
  }

  return { texto: String(diasTrabalhados), classe: "bg-slate-100 text-slate-700 border border-slate-200" }
}
