import { describe, expect, it } from "vitest"
import type { LinhaRevisaoJornada } from "@/lib/parsers/jornada-relatorio-parser"
import { categoriaDaLinha } from "./categoria-linha"

function linha(parcial: Partial<LinhaRevisaoJornada> = {}): LinhaRevisaoJornada {
  return {
    id: 1,
    ids: [1],
    matricula: 101,
    nome: "MOTORISTA",
    inicioJornada: "2026-09-17T08:51:00.000Z",
    fimJornada: "2026-09-17T17:20:00.000Z",
    dia: "2026-09-17T03:00:00.000Z",
    diasSemFolga: 4,
    diasSemFolgaRelatorio: 4,
    correcao: null,
    situacao: "IMPORTAR",
    batidaExtra: null,
    original: { inicio: "2026-09-17T08:51:00.000Z", fim: "2026-09-17T17:20:00.000Z" },
    editada: false,
    ...parcial,
  }
}

describe("categoriaDaLinha", () => {
  it("7º dia vence tudo; depois editada, corrigida, sem par", () => {
    expect(categoriaDaLinha(linha({ diasSemFolga: 7, editada: true }))).toBe("SETIMO_DIA")
    expect(categoriaDaLinha(linha({ editada: true, correcao: "BATIDA_SEM_PAR" }))).toBe("EDITADA")
    expect(categoriaDaLinha(linha({ correcao: "BATIDA_EXTRA", batidaExtra: "15:32" }))).toBe("CORRIGIDA")
    expect(categoriaDaLinha(linha({ diasSemFolga: 5, diasSemFolgaRelatorio: 6 }))).toBe("CORRIGIDA")
    expect(categoriaDaLinha(linha({ correcao: "BATIDA_SEM_PAR" }))).toBe("SEM_PAR")
    expect(categoriaDaLinha(linha())).toBe("OK")
  })

  it("linha fora do calendário fica cinza; ignorada por você fica azul", () => {
    expect(categoriaDaLinha(linha({ situacao: "ABSORVIDA" }))).toBe("FORA")
    expect(categoriaDaLinha(linha({ situacao: "MESMO_DIA", diasSemFolga: 8 }))).toBe("FORA")
    expect(categoriaDaLinha(linha({ situacao: "IGNORADA" }))).toBe("EDITADA")
  })
})
