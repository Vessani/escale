import { describe, expect, it } from "vitest"
import { determinarAcaoSugerida } from "./motoristas-ociosos.service"

describe("determinarAcaoSugerida", () => {
  it.each([1, 2, 3, 4, 5, 6])("sugere dar folga pra motorista em dia de trabalho (%i) sem viagem", (codigo) => {
    expect(determinarAcaoSugerida(codigo, "MOTORISTA")).toEqual({
      tipo: "DAR_FOLGA",
      texto: "Sem viagem hoje — considere dar folga.",
    })
  })

  it("não sugere nada pra quem já está de folga (7)", () => {
    expect(determinarAcaoSugerida(7, "MOTORISTA").tipo).toBe("NENHUMA")
  })

  it("não sugere nada pra quem está em férias (8)", () => {
    expect(determinarAcaoSugerida(8, "MOTORISTA").tipo).toBe("NENHUMA")
  })

  it("não sugere nada pra quem está em exames (9)", () => {
    expect(determinarAcaoSugerida(9, "MOTORISTA").tipo).toBe("NENHUMA")
  })

  it("sugere revisar o status Interno (10)", () => {
    expect(determinarAcaoSugerida(10, "MOTORISTA")).toEqual({
      tipo: "REVISAR_INTERNO",
      texto: "Marcado como Interno — confira se ainda faz sentido.",
    })
  })

  it("sugere revisar o status Manutenção (11)", () => {
    expect(determinarAcaoSugerida(11, "MOTORISTA")).toEqual({
      tipo: "REVISAR_MANUTENCAO",
      texto: "Marcado como Manutenção — confira se ainda faz sentido.",
    })
  })

  it("motorista em treinamento nunca recebe sugestão de folga ou interno, mesmo em dia de trabalho", () => {
    expect(determinarAcaoSugerida(3, "TREINAMENTO").tipo).toBe("NENHUMA")
  })

  it("motorista em treinamento marcado como Interno também não sugere revisar Interno", () => {
    expect(determinarAcaoSugerida(10, "TREINAMENTO").tipo).toBe("NENHUMA")
  })

  it("motorista em treinamento marcado como Manutenção também não sugere revisar Manutenção", () => {
    expect(determinarAcaoSugerida(11, "TREINAMENTO").tipo).toBe("NENHUMA")
  })

  it.each(["ENCHEDOR", "INTERNO"] as const)("%s sem viagem é o normal — não sugere folga", (tipo) => {
    expect(determinarAcaoSugerida(3, tipo).tipo).toBe("NENHUMA")
  })

  it("instrutor segue a regra do motorista comum", () => {
    expect(determinarAcaoSugerida(3, "INSTRUTOR").tipo).toBe("DAR_FOLGA")
  })
})
