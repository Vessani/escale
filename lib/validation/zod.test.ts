import { describe, expect, it } from "vitest"
import { z } from "./zod"
import { novaViagemSchema } from "./viagens"

describe("zod configurado em português", () => {
  it("mensagens padrão saem em português", () => {
    const resultado = z.enum(["A", "B"]).safeParse(undefined)

    expect(resultado.success).toBe(false)
    expect(resultado.error?.issues[0]?.message).toMatch(/^Opção inválida/)
  })

  it("produto vazio na viagem mostra mensagem própria", () => {
    const resultado = novaViagemSchema.safeParse({})
    const erroProduto = resultado.error?.issues.find((issue) => issue.path[0] === "produto")

    expect(erroProduto?.message).toBe("Selecione o produto.")
  })
})
