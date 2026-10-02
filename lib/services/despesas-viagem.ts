/** Totais de pedágio e pernoite de uma viagem — um lugar só (celular, card do escalador, relatórios). */
export function totaisDespesas(despesas: ReadonlyArray<{ tipo: "PEDAGIO" | "PERNOITE"; valorCentavos: number }>) {
  let pedagioCentavos = 0
  let pernoiteCentavos = 0
  for (const despesa of despesas) {
    if (despesa.tipo === "PEDAGIO") pedagioCentavos += despesa.valorCentavos
    else pernoiteCentavos += despesa.valorCentavos
  }
  return { pedagioCentavos, pernoiteCentavos, totalCentavos: pedagioCentavos + pernoiteCentavos }
}
