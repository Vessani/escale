const PARTICULAS = new Set(["da", "das", "de", "do", "dos", "e"])

/**
 * "FRANCINEI PAULINO" -> "Francinei Paulino", "RIO DO SUL" -> "Rio do Sul".
 * Só pra exibição — os nomes continuam gravados como vieram (planilha/SAP
 * mandam tudo em maiúsculas). Siglas curtas de 2 letras isoladas (ex: UF
 * "SC") ficam em maiúsculas.
 */
export function formatarNomeProprio(texto: string): string {
  return texto
    .trim()
    .toLocaleLowerCase("pt-BR")
    .split(/\s+/)
    .map((palavra, indice) => {
      if (indice > 0 && PARTICULAS.has(palavra)) return palavra
      if (palavra.length === 2 && indice > 0 && !/[aeiouáéíóú]/.test(palavra)) return palavra.toLocaleUpperCase("pt-BR")
      return palavra.charAt(0).toLocaleUpperCase("pt-BR") + palavra.slice(1)
    })
    .join(" ")
}

/** Cidades de destino, sem vazias e sem repetição seguida (duas entregas na mesma cidade viram uma parada). */
export function paradasDaRota(cidades: Array<string | null | undefined>): string[] {
  const paradas: string[] = []
  for (const cidade of cidades) {
    const nome = cidade?.trim()
    if (!nome) continue
    const formatada = formatarNomeProprio(nome)
    if (paradas[paradas.length - 1] !== formatada) paradas.push(formatada)
  }
  return paradas
}
