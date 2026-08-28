import { describe, expect, it } from "vitest"
import { Prisma } from "@prisma/client"
import { errorToMessage } from "@/lib/action-error"
import { ViagemNaoEncontradaError, FrotaDuplicadaError } from "@/lib/errors"

const FALLBACK = "Ocorreu um erro desconhecido."

function criarErroPrisma(code: string, meta?: Record<string, unknown>) {
  return new Prisma.PrismaClientKnownRequestError("mensagem interna do prisma", {
    code,
    clientVersion: "0.0.0",
    meta,
  })
}

describe("errorToMessage", () => {
  it("erro de domínio (ErroDeDominio) devolve mensagemSegura", () => {
    expect(errorToMessage(new ViagemNaoEncontradaError(), FALLBACK)).toBe("Viagem não encontrada.")
    expect(errorToMessage(new FrotaDuplicadaError(), FALLBACK)).toBe(
      "Já existe um conjunto cadastrado com essa frota (cavalo/carreta).",
    )
  })

  it("erro comum (não convertido, ex: bug ou throw solto) cai no fallback — nunca vaza a mensagem técnica", () => {
    expect(errorToMessage(new Error("Cannot read properties of undefined (reading 'x')"), FALLBACK)).toBe(FALLBACK)
    expect(errorToMessage(new TypeError("boom"), FALLBACK)).toBe(FALLBACK)
  })

  it("algo que nem é Error (string solta, undefined) cai no fallback", () => {
    expect(errorToMessage("string qualquer", FALLBACK)).toBe(FALLBACK)
    expect(errorToMessage(undefined, FALLBACK)).toBe(FALLBACK)
  })

  it("P2002 (unique constraint) mapeia pra mensagem amigável conforme a coluna do conflito", () => {
    expect(errorToMessage(criarErroPrisma("P2002", { target: ["numViagem"] }), FALLBACK)).toBe(
      "Já existe uma viagem com este número.",
    )
    expect(errorToMessage(criarErroPrisma("P2002", { target: ["email"] }), FALLBACK)).toBe(
      "Já existe um usuário com este e-mail.",
    )
    expect(errorToMessage(criarErroPrisma("P2002", { target: ["cpf"] }), FALLBACK)).toBe(
      "Já existe um motorista cadastrado com este CPF.",
    )
    expect(errorToMessage(criarErroPrisma("P2002", { target: ["outraColuna"] }), FALLBACK)).toBe(
      "Já existe um registro com estes dados.",
    )
  })

  it("P2025 (registro não encontrado) e P2003 (violação de FK) mapeiam pra mensagem amigável", () => {
    expect(errorToMessage(criarErroPrisma("P2025"), FALLBACK)).toBe("O registro informado não foi encontrado.")
    expect(errorToMessage(criarErroPrisma("P2003"), FALLBACK)).toBe(
      "Não foi possível concluir a operação por vínculo com outros dados.",
    )
  })

  it("código Prisma não mapeado cai no fallback", () => {
    expect(errorToMessage(criarErroPrisma("P9999"), FALLBACK)).toBe(FALLBACK)
  })
})
