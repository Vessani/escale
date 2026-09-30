import { describe, expect, it } from "vitest"
import { organizarViagensDoDashboard } from "./dashboard.service"

const v = (id: number, status: "INICIADA" | "FINALIZADA" | "CANCELADA" | "CRIADA", hora: string) => ({
  id,
  status,
  inicioPrevisto: new Date(`2026-09-30T${hora}:00-03:00`),
})

describe("organizarViagensDoDashboard", () => {
  const viagens = [v(1, "FINALIZADA", "05:00"), v(2, "INICIADA", "07:00"), v(3, "CANCELADA", "06:00"), v(4, "CRIADA", "06:30")]

  it("na visão Todos, encerradas vão pro fim e o resto fica em ordem de início", () => {
    const { visiveis } = organizarViagensDoDashboard(viagens, "TODOS")
    expect(visiveis.map((viagem) => viagem.id)).toEqual([4, 2, 1, 3])
  })

  it("a contagem é sempre do dia inteiro, mesmo com filtro", () => {
    const { visiveis, contagem, total } = organizarViagensDoDashboard(viagens, "FINALIZADA")
    expect(visiveis.map((viagem) => viagem.id)).toEqual([1])
    expect(contagem).toMatchObject({ FINALIZADA: 1, INICIADA: 1, CANCELADA: 1, CRIADA: 1 })
    expect(total).toBe(4)
  })
})
