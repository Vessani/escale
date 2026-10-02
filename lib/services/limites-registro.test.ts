import { describe, expect, it } from "vitest"
import { inicioDoMinuto, validarHoraDoRegistro, validarKmDoRegistro } from "./limites-registro"

const h = (hora: string) => new Date(`2026-10-02T${hora}-03:00`)

describe("limites-registro", () => {
  it("km: entre o inicial e +10.000; sem km inicial só confere o hodômetro", () => {
    expect(() => validarKmDoRegistro(152400, 152300, "Km da chegada")).not.toThrow()
    expect(() => validarKmDoRegistro(152000, 152300, "Km da chegada")).toThrow("Km da chegada: não pode ser menor que o km inicial (152300).")
    expect(() => validarKmDoRegistro(170000, 152300, "Km da troca")).toThrow("mais de 10.000 km")
    expect(() => validarKmDoRegistro(-1, null, "Km")).toThrow("só números")
    expect(() => validarKmDoRegistro(5, null, "Km")).not.toThrow()
  })

  it("hora: até 5 min no futuro; antes da saída só se for outro minuto", () => {
    const agora = h("10:00:00")
    expect(() => validarHoraDoRegistro(h("10:04:00"), null, agora, "chegada")).not.toThrow()
    expect(() => validarHoraDoRegistro(h("10:06:00"), null, agora, "chegada")).toThrow("A hora da chegada está no futuro")
    expect(() => validarHoraDoRegistro(h("09:29:00"), h("09:29:40"), agora, "troca")).not.toThrow()
    expect(() => validarHoraDoRegistro(h("09:28:00"), h("09:29:40"), agora, "troca")).toThrow("A hora da troca é antes da saída")
    expect(inicioDoMinuto(h("09:29:40"))).toBe(h("09:29:00").getTime())
  })
})
