import { describe, expect, it } from "vitest"
import { determinarAcaoSugerida } from "./motoristas-ociosos.service"

describe("determinarAcaoSugerida", () => {
  it.each([1, 2, 3, 4, 5, 6])("sugere dar folga pra dia de trabalho (%i) liberado sem viagem", (codigo) => {
    expect(determinarAcaoSugerida(codigo, true)).toEqual({
      tipo: "DAR_FOLGA",
      texto: "Sem viagem hoje — considere dar folga.",
    })
  })

  it("não sugere nada pra quem já está de folga (7)", () => {
    expect(determinarAcaoSugerida(7, true).tipo).toBe("NENHUMA")
  })

  it("não sugere nada pra quem está em férias (8)", () => {
    expect(determinarAcaoSugerida(8, true).tipo).toBe("NENHUMA")
  })

  it("não sugere nada pra quem está em exames (9)", () => {
    expect(determinarAcaoSugerida(9, true).tipo).toBe("NENHUMA")
  })

  it("sugere revisar o status Interno (10)", () => {
    expect(determinarAcaoSugerida(10, true)).toEqual({
      tipo: "REVISAR_INTERNO",
      texto: "Marcado como Interno — confira se ainda faz sentido.",
    })
  })

  it("motorista em treinamento (não liberado) nunca recebe sugestão de folga ou interno, mesmo em dia de trabalho", () => {
    expect(determinarAcaoSugerida(3, false).tipo).toBe("NENHUMA")
  })

  it("motorista em treinamento marcado como Interno também não sugere revisar Interno", () => {
    expect(determinarAcaoSugerida(10, false).tipo).toBe("NENHUMA")
  })
})
