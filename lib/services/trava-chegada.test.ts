import { describe, expect, it } from "vitest"
import { camposTravadosAlterados } from "./trava-chegada"

const base = { cliente: "HOSPITAL SANTA ISABEL", cidade: "BLUMENAU", uf: "SC", sapcode: "1002345", codewhite: "W5521" }

describe("camposTravadosAlterados", () => {
  it("nada mudou (ignora espaço e maiúscula/minúscula): pode gravar", () => {
    expect(camposTravadosAlterados(base, { ...base, cliente: " hospital santa isabel ", uf: "sc" })).toEqual([])
  })

  it("lista o que mudou, com o nome que aparece pra pessoa", () => {
    expect(camposTravadosAlterados(base, { ...base, cliente: "WEG", codewhite: "W9" })).toEqual(["cliente", "número white"])
    expect(camposTravadosAlterados(base, { ...base, sapcode: "" })).toEqual(["SAP code"])
  })
})
