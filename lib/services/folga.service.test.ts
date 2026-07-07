import { describe, expect, it } from "vitest"
import {
  deveMarcarMotoristaComoFolga,
  deveRetirarMotoristaDaFolga,
} from "@/lib/services/folga.service"

describe("folga.service", () => {
  it("marca como folga quem está em jornada 1..6 e sem viagem ativa", () => {
    expect(deveMarcarMotoristaComoFolga(1, false)).toBe(true)
    expect(deveMarcarMotoristaComoFolga(6, false)).toBe(true)
  })

  it("não marca como folga quem já está em folga ou status especial", () => {
    expect(deveMarcarMotoristaComoFolga(7, false)).toBe(false)
    expect(deveMarcarMotoristaComoFolga(8, false)).toBe(false)
  })

  it("não marca como folga quem está com viagem ativa", () => {
    expect(deveMarcarMotoristaComoFolga(3, true)).toBe(false)
  })

  it("retira da folga quando existe viagem ativa no dia", () => {
    expect(deveRetirarMotoristaDaFolga(7, true)).toBe(true)
  })

  it("mantém folga quando não existe viagem ativa no dia", () => {
    expect(deveRetirarMotoristaDaFolga(7, false)).toBe(false)
  })
})
