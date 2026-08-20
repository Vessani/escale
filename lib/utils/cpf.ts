export function somenteDigitosCpf(valor: string): string {
  return valor.replace(/\D/g, "")
}

export function formatarCpf(valor: string): string {
  const digitos = somenteDigitosCpf(valor)
  if (digitos.length !== 11) {
    return valor
  }
  return `${digitos.slice(0, 3)}.${digitos.slice(3, 6)}.${digitos.slice(6, 9)}-${digitos.slice(9, 11)}`
}

function calcularDigitoVerificador(base: string, pesoInicial: number): number {
  const soma = base
    .split("")
    .reduce((acc, digito, indice) => acc + Number(digito) * (pesoInicial - indice), 0)
  const resto = (soma * 10) % 11
  return resto === 10 ? 0 : resto
}

/**
 * Algoritmo padrão de dígito verificador de CPF (dois módulos 11
 * sucessivos). Rejeita sequências repetidas (00000000000, 11111111111...),
 * que passam no cálculo do dígito verificador mas nunca são CPFs reais.
 */
export function validarCpf(cpfSomenteDigitos: string): boolean {
  if (cpfSomenteDigitos.length !== 11 || /^(\d)\1{10}$/.test(cpfSomenteDigitos)) {
    return false
  }

  const digito1 = calcularDigitoVerificador(cpfSomenteDigitos.slice(0, 9), 10)
  const digito2 = calcularDigitoVerificador(cpfSomenteDigitos.slice(0, 9) + digito1, 11)

  return cpfSomenteDigitos.endsWith(`${digito1}${digito2}`)
}
