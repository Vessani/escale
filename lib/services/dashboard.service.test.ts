import { describe, expect, it } from "vitest"
import { organizarViagensDoDashboard, resumoPorTurno } from "./dashboard.service"

type Status = "INICIADA" | "FINALIZADA" | "CANCELADA" | "CRIADA" | "RETORNANDO" | "POSTERGADA"
const v = (id: number, status: Status, inicio: string) => ({ id, status, inicioPrevisto: new Date(`${inicio}:00-03:00`) })

describe("organizarViagensDoDashboard", () => {
  const viagens = [
    v(1, "FINALIZADA", "2026-09-30T05:00"),
    v(2, "INICIADA", "2026-09-30T07:00"),
    v(3, "CANCELADA", "2026-09-30T06:00"),
    v(4, "CRIADA", "2026-09-30T06:30"),
    v(5, "RETORNANDO", "2026-09-29T20:00"),
  ]

  it("a lista só tem as ativas (finalizada e cancelada viram só contador), em ordem de início", () => {
    const { ativas } = organizarViagensDoDashboard(viagens)
    expect(ativas.map((viagem) => viagem.id)).toEqual([5, 4, 2])
  })

  it("a contagem é do dia inteiro, encerradas inclusive", () => {
    const { contagem } = organizarViagensDoDashboard(viagens)
    expect(contagem).toMatchObject({ FINALIZADA: 1, INICIADA: 1, CANCELADA: 1, CRIADA: 1, RETORNANDO: 1 })
  })
})

describe("resumoPorTurno", () => {
  const inicioDia = new Date("2026-09-30T00:00:00-03:00")
  const fimDia = new Date("2026-09-30T23:59:59.999-03:00")
  const t = (status: Status, turno: "MANHA" | "NOITE", inicio: string, entregas: number) => ({
    status,
    turno,
    inicioPrevisto: new Date(`${inicio}:00-03:00`),
    entregas: Array.from({ length: entregas }),
  })

  it("conta viagens e entregas por turno; cancelada e retorno de ontem ficam fora; finalizada conta (fez parte da programação)", () => {
    const resumo = resumoPorTurno(
      [
        t("CRIADA", "MANHA", "2026-09-30T06:00", 2),
        t("FINALIZADA", "MANHA", "2026-09-30T08:00", 3),
        t("CANCELADA", "MANHA", "2026-09-30T09:00", 4),
        t("INICIADA", "NOITE", "2026-09-30T18:00", 1),
        t("POSTERGADA", "NOITE", "2026-09-30T22:00", 2),
        t("RETORNANDO", "NOITE", "2026-09-29T20:00", 5),
      ],
      inicioDia,
      fimDia,
    )
    expect(resumo.dia).toEqual({ viagens: 2, entregas: 5 })
    expect(resumo.noite).toEqual({ viagens: 2, entregas: 3 })
    expect(resumo.total).toEqual({ viagens: 4, entregas: 8 })
  })
})
