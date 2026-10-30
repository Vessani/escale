import { describe, expect, it } from "vitest"
import { apagarLocal, armazenamentoLocal, gravarLocal, lerLocal } from "./armazenamento-local"

const quebrado = {
  getItem: () => {
    throw new Error("SecurityError")
  },
  setItem: () => {
    throw new Error("QuotaExceededError")
  },
  removeItem: () => {
    throw new Error("SecurityError")
  },
}

describe("armazenamento local", () => {
  it("no servidor não há localStorage", () => {
    expect(armazenamentoLocal()).toBeNull()
    expect(lerLocal("x")).toBeNull()
    expect(() => gravarLocal("x", "1")).not.toThrow()
  })

  it("navegador que bloqueia ou está cheio: não quebra, só não lembra", () => {
    expect(lerLocal("x", quebrado)).toBeNull()
    expect(() => gravarLocal("x", "1", quebrado)).not.toThrow()
    expect(() => apagarLocal("x", quebrado)).not.toThrow()
  })

  it("grava, lê e apaga", () => {
    const dados = new Map<string, string>()
    const a = {
      getItem: (k: string) => dados.get(k) ?? null,
      setItem: (k: string, v: string) => void dados.set(k, v),
      removeItem: (k: string) => void dados.delete(k),
    }
    gravarLocal("nome", "Roberto", a)
    expect(lerLocal("nome", a)).toBe("Roberto")
    apagarLocal("nome", a)
    expect(lerLocal("nome", a)).toBeNull()
  })
})
