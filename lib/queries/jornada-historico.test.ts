import { describe, expect, it, vi } from "vitest"

vi.mock("@/lib/prisma", () => ({ prisma: { $queryRaw: vi.fn() } }))

import { completarHistoricoComAncora, inicioJanelaJornada } from "./jornada-historico"
import { projetarCodigoNoDia } from "@/lib/services/jornada.service"

describe("histórico de jornada em janela + âncora", () => {
  it("a janela começa N dias antes do início do dia de referência", () => {
    expect(inicioJanelaJornada(new Date("2026-09-30T15:00:00-03:00"), 60)).toEqual(new Date("2026-08-01T00:00:00-03:00"))
  })

  it("coloca a âncora (último registro antes da janela) antes do histórico da janela", async () => {
    const ancora = { data: new Date("2026-05-01T03:00:00Z"), codigo: 8, fimJornada: null }
    const db = { $queryRaw: vi.fn().mockResolvedValue([{ motoristaId: 1, ...ancora }]) }
    const naJanela = { data: new Date("2026-09-01T03:00:00Z"), codigo: 2 }

    const [comAncora, semAncora] = await completarHistoricoComAncora(
      [
        { id: 1, registrosJornada: [naJanela] },
        { id: 2, registrosJornada: [] },
      ],
      new Date("2026-08-01T03:00:00Z"),
      db as never,
    )

    expect(comAncora.registrosJornada).toEqual([ancora, naJanela])
    expect(semAncora.registrosJornada).toEqual([])
  })

  it("com a âncora, a projeção é a mesma que o histórico completo daria", async () => {
    // Histórico completo: só um registro, bem antigo (fora da janela).
    const antigo = { data: new Date("2026-06-01T03:00:00Z"), codigo: 3 }
    const dia = new Date("2026-09-30T12:00:00-03:00")
    const esperado = projetarCodigoNoDia([antigo], dia, dia, 1)

    const db = { $queryRaw: vi.fn().mockResolvedValue([{ motoristaId: 1, ...antigo, fimJornada: null }]) }
    const [motorista] = await completarHistoricoComAncora(
      [{ id: 1, registrosJornada: [] as Array<{ data: Date; codigo: number }> }],
      inicioJanelaJornada(dia),
      db as never,
    )

    expect(projetarCodigoNoDia(motorista.registrosJornada, dia, dia, 1)).toBe(esperado)
  })
})
