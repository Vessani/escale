import { describe, expect, it } from "vitest"
import type { StatusIntegracao, Turno } from "@prisma/client"
import {
  calcularDiasDisponiveis,
  calcularIntegracaoExigida,
  filtrarMotoristasCompativeis,
  filtrarMotoristasDisponiveisNoPeriodo,
  motoristaEstaDisponivelNoPeriodo,
  motoristaEhCompativel,
} from "@/lib/services/alocacao.service"

type MotoristaMock = {
  id: number
  nome: string
  turno: Turno
  diasTrabalhados: number
  integracao: Array<{
    cliente: string
    status: StatusIntegracao
    dataValidade: Date
  }>
}

function criarMotorista(parcial: Partial<MotoristaMock>): MotoristaMock {
  return {
    id: 1,
    nome: "Motorista Teste",
    turno: "MANHA",
    diasTrabalhados: 2,
    integracao: [],
    ...parcial,
  }
}

describe("alocacao.service", () => {
  it("calcula dias disponíveis apenas para jornada válida", () => {
    expect(calcularDiasDisponiveis(1)).toBe(5)
    expect(calcularDiasDisponiveis(6)).toBe(0)
    expect(calcularDiasDisponiveis(7)).toBe(0)
  })

  it("detecta integração obrigatória por cliente normalizado", () => {
    const integracao = calcularIntegracaoExigida([
      { cliente: "cliente comum" },
      { cliente: "  ambev " },
    ])

    expect(integracao).toBe("AMBEV")
  })

  it("nega compatibilidade quando turno diverge", () => {
    const motorista = criarMotorista({ turno: "NOITE" })
    const compativel = motoristaEhCompativel(motorista, {
      turnoViagem: "MANHA",
      diasViagem: 2,
      dataInicioViagem: new Date("2026-07-10"),
      integracaoExigida: null,
    })

    expect(compativel).toBe(false)
  })

  it("exige integração ativa e válida quando cliente pede integração", () => {
    const motoristaSemIntegracao = criarMotorista({
      integracao: [{ cliente: "AMBEV", status: "INATIVO", dataValidade: new Date("2026-12-01") }],
    })

    const motoristaComIntegracao = criarMotorista({
      id: 2,
      nome: "Com integração",
      integracao: [{ cliente: "ambev", status: "ATIVO", dataValidade: new Date("2026-12-01") }],
    })

    const contexto = {
      turnoViagem: "MANHA" as Turno,
      diasViagem: 2,
      dataInicioViagem: new Date("2026-07-10"),
      integracaoExigida: "AMBEV",
    }

    const resultado = filtrarMotoristasCompativeis([motoristaSemIntegracao, motoristaComIntegracao], contexto)
    expect(resultado.map((motorista) => motorista.id)).toEqual([2])
  })

  it("marca motorista como indisponível quando já possui viagem sobreposta ativa", () => {
    const inicioNovaViagem = new Date("2026-07-10T09:00:00.000Z")
    const fimNovaViagem = new Date("2026-07-11T09:00:00.000Z")

    const disponivel = motoristaEstaDisponivelNoPeriodo(
      {
        ...criarMotorista({ id: 10 }),
        viagens: [
          {
            id: 100,
            inicioPrevisto: new Date("2026-07-10T08:00:00.000Z"),
            fimPrevisto: new Date("2026-07-10T12:00:00.000Z"),
            status: "ALOCADA",
            deletadoEm: null,
          },
        ],
      },
      inicioNovaViagem,
      fimNovaViagem,
    )

    expect(disponivel).toBe(false)
  })

  it("ignora viagens canceladas/finalizadas e mantém motorista disponível", () => {
    const inicioNovaViagem = new Date("2026-07-10T09:00:00.000Z")
    const fimNovaViagem = new Date("2026-07-11T09:00:00.000Z")

    const disponivel = motoristaEstaDisponivelNoPeriodo(
      {
        ...criarMotorista({ id: 11 }),
        viagens: [
          {
            id: 101,
            inicioPrevisto: new Date("2026-07-10T08:00:00.000Z"),
            fimPrevisto: new Date("2026-07-10T12:00:00.000Z"),
            status: "CANCELADA",
            deletadoEm: null,
          },
          {
            id: 102,
            inicioPrevisto: new Date("2026-07-10T08:00:00.000Z"),
            fimPrevisto: new Date("2026-07-10T12:00:00.000Z"),
            status: "FINALIZADA",
            deletadoEm: null,
          },
        ],
      },
      inicioNovaViagem,
      fimNovaViagem,
    )

    expect(disponivel).toBe(true)
  })

  it("filtra lista para manter apenas motoristas disponíveis por período", () => {
    const inicioNovaViagem = new Date("2026-07-10T09:00:00.000Z")
    const fimNovaViagem = new Date("2026-07-11T09:00:00.000Z")

    const resultado = filtrarMotoristasDisponiveisNoPeriodo(
      [
        {
          ...criarMotorista({ id: 1, nome: "Ocupado" }),
          viagens: [
            {
              id: 201,
              inicioPrevisto: new Date("2026-07-10T08:00:00.000Z"),
              fimPrevisto: new Date("2026-07-10T12:00:00.000Z"),
              status: "EM_CURSO",
              deletadoEm: null,
            },
          ],
        },
        {
          ...criarMotorista({ id: 2, nome: "Livre" }),
          viagens: [
            {
              id: 202,
              inicioPrevisto: new Date("2026-07-12T08:00:00.000Z"),
              fimPrevisto: new Date("2026-07-12T12:00:00.000Z"),
              status: "ALOCADA",
              deletadoEm: null,
            },
          ],
        },
      ],
      inicioNovaViagem,
      fimNovaViagem,
    )

    expect(resultado.map((motorista) => motorista.nome)).toEqual(["Livre"])
  })
})
