import { describe, expect, it } from "vitest"
import type { StatusIntegracao, Turno } from "@prisma/client"
import {
  calcularDiasDisponiveis,
  calcularIntegracaoExigida,
  filtrarMotoristasCompativeis,
  filtrarMotoristasDisponiveisNoPeriodo,
  motoristaEstaDisponivelNoPeriodo,
  motoristaEhCompativel,
  sugerirAlocacoesEmLote,
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
    expect(calcularDiasDisponiveis(0)).toBe(0)
    expect(calcularDiasDisponiveis(1)).toBe(5)
    expect(calcularDiasDisponiveis(6)).toBe(0)
    expect(calcularDiasDisponiveis(7)).toBe(6)
    expect(calcularDiasDisponiveis(8)).toBe(0)
  })

  it("trata motorista com 0 dias como incompatível por jornada", () => {
    const motorista = criarMotorista({ diasTrabalhados: 0 })
    const compativel = motoristaEhCompativel(motorista, {
      turnoViagem: "MANHA",
      diasViagem: 1,
      dataInicioViagem: new Date("2026-07-10"),
      integracaoExigida: null,
    })

    expect(compativel).toBe(false)
  })

  it("trata motorista em folga como compatível para iniciar jornada", () => {
    const motorista = criarMotorista({ diasTrabalhados: 7 })
    const compativel = motoristaEhCompativel(motorista, {
      turnoViagem: "MANHA",
      diasViagem: 2,
      dataInicioViagem: new Date("2026-07-10"),
      integracaoExigida: null,
    })

    expect(compativel).toBe(true)
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
              status: "INICIADA",
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

  it("marca indisponível no dia seguinte ao fim de uma viagem, mesmo sem sobreposição de horário", () => {
    // Reproduz o caso real: viagem termina dia 9 às 03h, próxima começa dia 9 às 09h.
    // Mesmo sem sobrepor horário, o motorista precisa de 1 dia calendário inteiro de descanso.
    const motorista = {
      ...criarMotorista({ id: 1, nome: "Dilson" }),
      viagens: [
        {
          id: 1,
          inicioPrevisto: new Date("2026-07-08T08:00:00.000Z"),
          fimPrevisto: new Date("2026-07-09T03:00:00.000Z"),
          status: "ALOCADA" as const,
          deletadoEm: null,
        },
      ],
    }

    const disponivel = motoristaEstaDisponivelNoPeriodo(
      motorista,
      new Date("2026-07-09T09:00:00.000Z"),
      new Date("2026-07-10T03:00:00.000Z"),
    )

    expect(disponivel).toBe(false)
  })

  it("libera o motorista a partir do dia seguinte ao fim da viagem anterior", () => {
    const motorista = {
      ...criarMotorista({ id: 1, nome: "Dilson" }),
      viagens: [
        {
          id: 1,
          inicioPrevisto: new Date("2026-07-08T08:00:00.000Z"),
          fimPrevisto: new Date("2026-07-09T03:00:00.000Z"), // termina dia 9
          status: "ALOCADA" as const,
          deletadoEm: null,
        },
      ],
    }

    // Nova viagem no dia 10 (dia seguinte ao fim) já deve estar liberada
    const disponivel = motoristaEstaDisponivelNoPeriodo(
      motorista,
      new Date("2026-07-10T05:00:00.000Z"),
      new Date("2026-07-10T20:00:00.000Z"),
    )

    expect(disponivel).toBe(true)
  })

  it("ainda bloqueia se a nova viagem começar mais tarde no mesmo dia em que a anterior termina", () => {
    const motorista = {
      ...criarMotorista({ id: 1, nome: "Dilson" }),
      viagens: [
        {
          id: 1,
          inicioPrevisto: new Date("2026-07-08T08:00:00.000Z"),
          fimPrevisto: new Date("2026-07-09T03:00:00.000Z"),
          status: "ALOCADA" as const,
          deletadoEm: null,
        },
      ],
    }

    // Mesmo tarde da noite do dia 9, ainda é o mesmo dia calendário do fim da viagem anterior
    const disponivel = motoristaEstaDisponivelNoPeriodo(
      motorista,
      new Date("2026-07-09T23:00:00.000Z"),
      new Date("2026-07-10T10:00:00.000Z"),
    )

    expect(disponivel).toBe(false)
  })

  describe("sugerirAlocacoesEmLote", () => {
    function criarMotoristaComAgenda(parcial: Partial<MotoristaMock>) {
      return { ...criarMotorista(parcial), viagens: [] }
    }

    it("não sugere o mesmo motorista para duas viagens do lote com período sobreposto", () => {
      const motoristaTop = criarMotoristaComAgenda({ id: 1, nome: "Ana", diasTrabalhados: 1 }) // 5 dias disponíveis
      const motoristaSegundo = criarMotoristaComAgenda({ id: 2, nome: "Bruno", diasTrabalhados: 3 }) // 3 dias disponíveis

      const viagens = [
        {
          id: 10,
          turno: "MANHA" as Turno,
          diasViagem: 2,
          inicioPrevisto: new Date("2026-07-04T08:00:00.000Z"),
          fimPrevisto: new Date("2026-07-06T08:00:00.000Z"),
          integracaoExigida: null,
        },
        {
          id: 11,
          turno: "MANHA" as Turno,
          diasViagem: 2,
          inicioPrevisto: new Date("2026-07-05T08:00:00.000Z"), // sobrepõe a viagem 10
          fimPrevisto: new Date("2026-07-07T08:00:00.000Z"),
          integracaoExigida: null,
        },
      ]

      const resultado = sugerirAlocacoesEmLote(viagens, [motoristaTop, motoristaSegundo])

      expect(resultado[0].motoristaSugerido?.id).toBe(1)
      expect(resultado[1].motoristaSugerido?.id).toBe(2)
    })

    it("permite sugerir o mesmo motorista para duas viagens do lote quando os períodos não se sobrepõem", () => {
      const motorista = criarMotoristaComAgenda({ id: 1, nome: "Ana", diasTrabalhados: 1 })

      const viagens = [
        {
          id: 10,
          turno: "MANHA" as Turno,
          diasViagem: 1,
          inicioPrevisto: new Date("2026-07-04T08:00:00.000Z"),
          fimPrevisto: new Date("2026-07-04T20:00:00.000Z"),
          integracaoExigida: null,
        },
        {
          id: 11,
          turno: "MANHA" as Turno,
          diasViagem: 1,
          inicioPrevisto: new Date("2026-07-10T08:00:00.000Z"),
          fimPrevisto: new Date("2026-07-10T20:00:00.000Z"),
          integracaoExigida: null,
        },
      ]

      const resultado = sugerirAlocacoesEmLote(viagens, [motorista])

      expect(resultado[0].motoristaSugerido?.id).toBe(1)
      expect(resultado[1].motoristaSugerido?.id).toBe(1)
    })

    it("retorna null quando sobra só um motorista compatível e ele já foi usado numa viagem sobreposta", () => {
      const unico = criarMotoristaComAgenda({ id: 1, nome: "Ana", diasTrabalhados: 1 })

      const viagens = [
        {
          id: 10,
          turno: "MANHA" as Turno,
          diasViagem: 2,
          inicioPrevisto: new Date("2026-07-04T08:00:00.000Z"),
          fimPrevisto: new Date("2026-07-06T08:00:00.000Z"),
          integracaoExigida: null,
        },
        {
          id: 11,
          turno: "MANHA" as Turno,
          diasViagem: 2,
          inicioPrevisto: new Date("2026-07-05T08:00:00.000Z"),
          fimPrevisto: new Date("2026-07-07T08:00:00.000Z"),
          integracaoExigida: null,
        },
      ]

      const resultado = sugerirAlocacoesEmLote(viagens, [unico])

      expect(resultado[0].motoristaSugerido?.id).toBe(1)
      expect(resultado[1].motoristaSugerido).toBeNull()
      expect(resultado[1].motoristasCompativeis).toEqual([])
    })
  })
})
