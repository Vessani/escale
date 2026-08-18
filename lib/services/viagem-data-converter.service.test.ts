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

  it("interpreta string sem timezone (datetime-local) como horário de Brasília — a causa raiz do bug de fuso relatado", () => {
    const resultado = converterEditarViagemParaBD(
      criarDadosEdicao({ inicioPrevisto: "2026-07-10T08:00", fimPrevisto: "2026-07-10T18:00" }),
    )

    expect((resultado.inicioPrevisto as Date).toISOString()).toBe("2026-07-10T11:00:00.000Z")
    expect((resultado.fimPrevisto as Date).toISOString()).toBe("2026-07-10T21:00:00.000Z")
  })

  it("não reajusta uma string que já traz timezone explícito (ex: vinda de serializeData no fluxo de alocação)", () => {
    const resultado = converterEditarViagemParaBD(
      criarDadosEdicao({ inicioPrevisto: "2026-07-10T11:00:00.000Z", fimPrevisto: "2026-07-10T21:00:00.000Z" }),
    )

    expect((resultado.inicioPrevisto as Date).toISOString()).toBe("2026-07-10T11:00:00.000Z")
    expect((resultado.fimPrevisto as Date).toISOString()).toBe("2026-07-10T21:00:00.000Z")
  })

  it("aceita um Date já construído sem reprocessar", () => {
    const inicio = new Date("2026-07-10T11:00:00.000Z")
    const resultado = converterEditarViagemParaBD(
      criarDadosEdicao({ inicioPrevisto: inicio, fimPrevisto: "2026-07-10T21:00:00.000Z" }),
    )

    expect(resultado.inicioPrevisto).toBe(inicio)
  })

  it("interpreta dataEntrega das entregas com a mesma regra de fuso", () => {
    const resultado = converterEditarViagemParaBD(
      criarDadosEdicao({
        entregas: [
          { dataEntrega: "2026-07-10T09:00", cliente: "Cliente Teste", cidade: "Joinville", uf: "SC", kg: 100, m3: 1, obs: "" },
        ],
      }),
    )

    expect((resultado.entregas[0].dataEntrega as Date).toISOString()).toBe("2026-07-10T12:00:00.000Z")
  })
})
