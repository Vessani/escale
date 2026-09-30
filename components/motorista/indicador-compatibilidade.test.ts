import { describe, expect, it } from "vitest"
import { situacaoDoMotorista } from "./indicador-compatibilidade"

describe("situacaoDoMotorista (substitui os rótulos '(Compatível)', '(Emergência)'...)", () => {
  it.each([
    [true, true, "OK"],
    [true, false, "SEM_DESCANSO"],
    [false, true, "FORA_DA_REGRA"],
    [false, false, "FORA_DA_REGRA_SEM_DESCANSO"],
  ] as const)("compatível=%s, disponível=%s → %s", (compativel, disponivel, esperado) => {
    expect(situacaoDoMotorista(compativel, disponivel)).toBe(esperado)
  })
})
