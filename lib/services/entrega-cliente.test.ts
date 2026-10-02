import { describe, expect, it } from "vitest"
import { ehEntregaDeCliente, soEntregasDeCliente } from "./entrega-cliente"

describe("ehEntregaDeCliente", () => {
  it("precisa dos dois códigos preenchidos de verdade", () => {
    expect(ehEntregaDeCliente({ sapcode: "2001", codewhite: "W10" })).toBe(true)
    expect(ehEntregaDeCliente({ sapcode: "", codewhite: "" })).toBe(false) // origem (Joinville)
    expect(ehEntregaDeCliente({ sapcode: "2001", codewhite: "" })).toBe(false)
    expect(ehEntregaDeCliente({ sapcode: null, codewhite: "W10" })).toBe(false)
    expect(ehEntregaDeCliente({ sapcode: "000", codewhite: "W10" })).toBe(false)
    expect(ehEntregaDeCliente({ sapcode: "2001", codewhite: " - " })).toBe(false)
    expect(ehEntregaDeCliente({})).toBe(false)
  })

  it("filtra mantendo a ordem", () => {
    const lista = [{ id: 1, sapcode: "", codewhite: "" }, { id: 2, sapcode: "1", codewhite: "W1" }, { id: 3, sapcode: "2", codewhite: "W2" }]
    expect(soEntregasDeCliente(lista).map((e) => e.id)).toEqual([2, 3])
  })
})
