import { describe, expect, it } from "vitest"
import { converterEditarViagemParaBD } from "@/lib/services/viagem-data-converter.service"
import type { EditarViagemInput } from "@/lib/types/types"

function criarDadosEdicao(parcial: Partial<EditarViagemInput> = {}): EditarViagemInput {
  return {
    numViagem: "10045",
    carreta: "908",
    cavalo: "2064",
    tanque: "STCV-28",
    diasViagem: 1,
    inicioPrevisto: "2026-07-10T08:00",
    fimPrevisto: "2026-07-10T20:00",
    turno: "MANHA",
    entregas: [],
    ...parcial,
  }
}

describe("viagem-data-converter.service", () => {
  it("continua recalculando diasViagem a partir do intervalo real, ignorando o valor enviado (comportamento existente)", () => {
    const resultado = converterEditarViagemParaBD(
      criarDadosEdicao({ diasViagem: 99, inicioPrevisto: "2026-07-10T08:00", fimPrevisto: "2026-07-10T08:00" }),
    )

    expect(resultado.diasViagem).toBe(1)
  })
})
