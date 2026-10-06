import { describe, expect, it } from "vitest"
import { entraNaSugestaoAutomatica, podeSerAcompanhante, podeSerPrincipal, TIPO_MOTORISTA_VALORES } from "./tipo-motorista"

describe("regras por tipo de motorista", () => {
  it.each([
    // tipo,          sugestão, principal, acompanhante
    ["MOTORISTA", true, true, true],
    ["TREINAMENTO", false, false, true],
    ["INSTRUTOR", false, true, true],
    ["INTERNO", false, true, true],
    ["ENCHEDOR", false, false, false],
  ] as const)("%s", (tipo, sugestao, principal, acompanhante) => {
    expect(entraNaSugestaoAutomatica(tipo)).toBe(sugestao)
    expect(podeSerPrincipal(tipo)).toBe(principal)
    expect(podeSerAcompanhante(tipo)).toBe(acompanhante)
  })

  it("cobre todos os tipos do enum", () => {
    expect(TIPO_MOTORISTA_VALORES).toHaveLength(5)
  })
})
