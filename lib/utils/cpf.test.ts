import { describe, expect, it } from "vitest"
import { formatarCpf, somenteDigitosCpf, validarCpf } from "./cpf"

describe("somenteDigitosCpf", () => {
  it("remove pontuação e mantém só os dígitos", () => {
    expect(somenteDigitosCpf("111.444.777-35")).toBe("11144477735")
  })
})

describe("formatarCpf", () => {
  it("formata 11 dígitos em 000.000.000-00", () => {
    expect(formatarCpf("11144477735")).toBe("111.444.777-35")
  })

  it("retorna o valor original quando não tem 11 dígitos (ex: ainda sendo digitado)", () => {
    expect(formatarCpf("111444")).toBe("111444")
  })
})

describe("validarCpf", () => {
  it("aceita CPFs válidos conhecidos (dígito verificador correto)", () => {
    expect(validarCpf("11144477735")).toBe(true)
    expect(validarCpf("52998224725")).toBe(true)
  })

  it("rejeita sequências repetidas, mesmo que o cálculo do dígito verificador coincida", () => {
    expect(validarCpf("00000000000")).toBe(false)
    expect(validarCpf("11111111111")).toBe(false)
    expect(validarCpf("99999999999")).toBe(false)
  })

  it("rejeita comprimento diferente de 11 dígitos", () => {
    expect(validarCpf("1114447773")).toBe(false)
    expect(validarCpf("111444777355")).toBe(false)
  })

  it("rejeita um CPF com um único dígito trocado (prova que valida o checksum, não só o formato)", () => {
    // 11144477735 é válido; trocar o penúltimo dígito quebra o dígito verificador.
    expect(validarCpf("11144477745")).toBe(false)
  })

  it("rejeita string vazia", () => {
    expect(validarCpf("")).toBe(false)
  })
})
