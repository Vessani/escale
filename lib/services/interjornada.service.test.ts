import { describe, expect, it, vi } from "vitest"
import type { StatusViagem } from "@prisma/client"

vi.mock("@/lib/prisma", () => ({ prisma: {} }))

import {
  calcularAvisoDescanso,
  fimEfetivoViagem,
  motoristaEstaDisponivelNoPeriodo,
} from "@/lib/services/alocacao.service"
import { recalcularAvisosInterjornada } from "@/lib/services/interjornada.service"

type ViagemMock = {
  id: number
  inicioPrevisto: Date
  fimPrevisto: Date
  status: StatusViagem
  deletadoEm: Date | null
  finalizadoEm?: Date | null
}

function criarViagem(parcial: Partial<ViagemMock> = {}): ViagemMock {
  return {
    id: 1,
    inicioPrevisto: new Date("2026-07-08T08:00:00"),
    fimPrevisto: new Date("2026-07-08T22:00:00"),
    status: "ALOCADA",
    deletadoEm: null,
    finalizadoEm: null,
    ...parcial,
  }
}

/** Motorista com agenda — sem relatório importado por padrão, então o descanso vem só das viagens. */
function criarMotorista(parcial: {
  diasTrabalhados?: number
  viagens?: ViagemMock[]
  registrosJornada?: Array<{ data: Date; codigo: number; fimJornada?: Date | null }>
} = {}) {
  return {
    id: 1,
    nome: "Motorista Teste",
    turno: "MANHA" as const,
    diasTrabalhados: 3,
    tipo: "MOTORISTA" as const,
    integracao: [],
    registrosJornada: [],
    jornadaRelatorioInicio: null,
    jornadaRelatorioFim: null,
    produtosAutorizados: [],
    viagens: [],
    ...parcial,
  }
}

const hoje = new Date("2026-07-08T00:00:00")

// Viagem de 08/07, prevista pras 08h–22h, mas a rota encerrou mais cedo e foi
// finalizada às 14h — o caso que motivou a regra.
const finalizadaCedo = criarViagem({
  status: "FINALIZADA",
  finalizadoEm: new Date("2026-07-08T14:00:00"),
})

describe("finalizar a viagem libera o motorista (descanso conta da finalização)", () => {
  describe("fimEfetivoViagem", () => {
    it("viagem em aberto termina no fim previsto", () => {
      expect(fimEfetivoViagem(criarViagem())).toEqual(new Date("2026-07-08T22:00:00"))
    })

    it("finalizada antes do fim previsto termina na finalização", () => {
      expect(fimEfetivoViagem(finalizadaCedo)).toEqual(new Date("2026-07-08T14:00:00"))
    })

    it("finalizada depois do fim previsto (marcada tarde) continua terminando no fim previsto", () => {
      const viagem = criarViagem({ status: "FINALIZADA", finalizadoEm: new Date("2026-07-09T09:00:00") })
      expect(fimEfetivoViagem(viagem)).toEqual(new Date("2026-07-08T22:00:00"))
    })

    it("finalizada antes desta regra existir (sem finalizadoEm) usa o fim previsto", () => {
      const viagem = criarViagem({ status: "FINALIZADA", finalizadoEm: null })
      expect(fimEfetivoViagem(viagem)).toEqual(new Date("2026-07-08T22:00:00"))
    })

    it("nunca termina antes do início previsto (finalizada por engano antes de começar)", () => {
      const viagem = criarViagem({ status: "FINALIZADA", finalizadoEm: new Date("2026-07-07T20:00:00") })
      expect(fimEfetivoViagem(viagem)).toEqual(new Date("2026-07-08T08:00:00"))
    })

    it("finalizadoEm de uma viagem que não está mais FINALIZADA é ignorado", () => {
      const viagem = criarViagem({ status: "RETORNANDO", finalizadoEm: new Date("2026-07-08T14:00:00") })
      expect(fimEfetivoViagem(viagem)).toEqual(new Date("2026-07-08T22:00:00"))
    })
  })

  describe("motoristaEstaDisponivelNoPeriodo", () => {
    const inicioAmanhaCedo = new Date("2026-07-09T03:00:00")
    const fimAmanha = new Date("2026-07-09T15:00:00")

    it("finalizada às 14h libera uma viagem às 03h do dia seguinte (13h de descanso)", () => {
      const motorista = criarMotorista({ viagens: [finalizadaCedo] })
      expect(motoristaEstaDisponivelNoPeriodo(motorista, inicioAmanhaCedo, fimAmanha, hoje)).toBe(true)
    })

    it("a mesma viagem sem finalizar continua bloqueando (só 5h depois do fim previsto)", () => {
      const motorista = criarMotorista({ viagens: [criarViagem({ status: "INICIADA" })] })
      expect(motoristaEstaDisponivelNoPeriodo(motorista, inicioAmanhaCedo, fimAmanha, hoje)).toBe(false)
    })

    it("finalizar não dispensa as 11h: uma viagem 6h depois da finalização continua bloqueada", () => {
      const motorista = criarMotorista({ viagens: [finalizadaCedo] })
      expect(
        motoristaEstaDisponivelNoPeriodo(motorista, new Date("2026-07-08T20:00:00"), new Date("2026-07-09T06:00:00"), hoje),
      ).toBe(false)
    })

    it("no 6º dia exige 35h contadas da finalização", () => {
      const motorista = criarMotorista({ diasTrabalhados: 6, viagens: [finalizadaCedo] })

      // 14h (08/07) + 35h = 01h de 10/07.
      expect(
        motoristaEstaDisponivelNoPeriodo(motorista, new Date("2026-07-10T00:30:00"), new Date("2026-07-10T12:00:00"), hoje),
      ).toBe(false)
      expect(
        motoristaEstaDisponivelNoPeriodo(motorista, new Date("2026-07-10T01:00:00"), new Date("2026-07-10T12:00:00"), hoje),
      ).toBe(true)
    })
  })

  describe("calcularAvisoDescanso", () => {
    const viagemAmanha = { id: 2, inicioPrevisto: new Date("2026-07-09T03:00:00") }

    it("sem relatório nem viagem anterior, não avisa", () => {
      expect(calcularAvisoDescanso(criarMotorista(), viagemAmanha, hoje)).toBeNull()
    })

    it("viagem anterior finalizada cedo: descanso suficiente, sem aviso", () => {
      expect(calcularAvisoDescanso(criarMotorista({ viagens: [finalizadaCedo] }), viagemAmanha, hoje)).toBeNull()
    })

    it("viagem anterior ainda em aberto: avisa contando do fim previsto", () => {
      const motorista = criarMotorista({ viagens: [criarViagem({ status: "INICIADA" })] })
      expect(calcularAvisoDescanso(motorista, viagemAmanha, hoje)).toBe(
        "Interjornada: motorista teve apenas 5.0h de descanso (mínimo 11h).",
      )
    })

    it("no 6º dia avisa o descanso semanal de 35h", () => {
      const motorista = criarMotorista({ diasTrabalhados: 6, viagens: [finalizadaCedo] })
      const viagemDepoisDeAmanha = { id: 2, inicioPrevisto: new Date("2026-07-09T20:00:00") }

      expect(calcularAvisoDescanso(motorista, viagemDepoisDeAmanha, hoje)).toBe(
        "Descanso semanal: motorista teve apenas 30.0h de descanso (mínimo 35h).",
      )
    })

    it("o relatório importado (rastreador) vale quando mostra um fim real mais tarde que a finalização", () => {
      const motorista = criarMotorista({
        viagens: [finalizadaCedo],
        registrosJornada: [
          { data: new Date("2026-07-08T00:00:00"), codigo: 3, fimJornada: new Date("2026-07-08T18:00:00") },
        ],
      })

      expect(calcularAvisoDescanso(motorista, viagemAmanha, hoje)).toBe(
        "Interjornada: motorista teve apenas 9.0h de descanso (mínimo 11h).",
      )
    })

    it("ignora a própria viagem, viagens que começam depois dela e viagens canceladas", () => {
      const motorista = criarMotorista({
        viagens: [
          criarViagem({ id: 2, inicioPrevisto: new Date("2026-07-09T03:00:00"), fimPrevisto: new Date("2026-07-09T15:00:00") }),
          criarViagem({ id: 3, inicioPrevisto: new Date("2026-07-09T20:00:00"), fimPrevisto: new Date("2026-07-10T02:00:00") }),
          criarViagem({ id: 4, status: "CANCELADA" }),
        ],
      })

      expect(calcularAvisoDescanso(motorista, viagemAmanha, hoje)).toBeNull()
    })
  })
})

describe("recalcularAvisosInterjornada", () => {
  const FILIAL_ID = 1
  const agora = new Date("2026-07-08T15:00:00")

  function criarTx(motoristas: unknown[]) {
    return {
      motorista: { findMany: vi.fn().mockResolvedValue(motoristas) },
      viagem: { update: vi.fn() },
      // Âncora de jornada antes da janela (ver jornada-historico.ts) — nenhuma aqui.
      $queryRaw: vi.fn().mockResolvedValue([]),
    }
  }

  function motoristaDoBanco(viagens: Array<ViagemMock & { avisoInterjornada: string | null }>, acompanhante: ViagemMock[] = []) {
    return { id: 1, diasTrabalhados: 3, registrosJornada: [], viagens, viagensComoAcompanhante: acompanhante }
  }

  it("sem motorista envolvido, não consulta nada", async () => {
    const tx = criarTx([])

    await recalcularAvisosInterjornada(tx as never, FILIAL_ID, [null, undefined], agora)

    expect(tx.motorista.findMany).not.toHaveBeenCalled()
  })

  it("finalizar a viagem de hoje apaga o aviso que estava gravado na viagem de amanhã", async () => {
    const amanha = {
      ...criarViagem({ id: 2, inicioPrevisto: new Date("2026-07-09T03:00:00"), fimPrevisto: new Date("2026-07-09T15:00:00") }),
      avisoInterjornada: "Interjornada: motorista teve apenas 5.0h de descanso (mínimo 11h).",
    }
    const tx = criarTx([motoristaDoBanco([{ ...finalizadaCedo, avisoInterjornada: null }, amanha])])

    await recalcularAvisosInterjornada(tx as never, FILIAL_ID, [1, 1], agora)

    expect(tx.motorista.findMany).toHaveBeenCalledTimes(1)
    expect(vi.mocked(tx.motorista.findMany).mock.calls[0][0]).toMatchObject({ where: { id: { in: [1] }, filialId: FILIAL_ID } })
    expect(tx.viagem.update).toHaveBeenCalledTimes(1)
    expect(tx.viagem.update).toHaveBeenCalledWith({ where: { id: 2 }, data: { avisoInterjornada: null } })
  })

  it("trabalho como acompanhante também conta como jornada anterior", async () => {
    const amanha = {
      ...criarViagem({ id: 2, inicioPrevisto: new Date("2026-07-09T03:00:00"), fimPrevisto: new Date("2026-07-09T15:00:00") }),
      avisoInterjornada: null,
    }
    const comoAcompanhante = criarViagem({ id: 9, status: "INICIADA" })
    const tx = criarTx([motoristaDoBanco([amanha], [comoAcompanhante])])

    await recalcularAvisosInterjornada(tx as never, FILIAL_ID, [1], agora)

    expect(tx.viagem.update).toHaveBeenCalledWith({
      where: { id: 2 },
      data: { avisoInterjornada: "Interjornada: motorista teve apenas 5.0h de descanso (mínimo 11h)." },
    })
  })

  it("não regrava quando o aviso não mudou e não mexe no aviso histórico de viagens finalizadas/canceladas", async () => {
    const finalizadaComAvisoAntigo = { ...finalizadaCedo, id: 5, avisoInterjornada: "aviso antigo" }
    const canceladaComAvisoAntigo = { ...criarViagem({ id: 6, status: "CANCELADA" }), avisoInterjornada: "aviso antigo" }
    const semMudanca = {
      ...criarViagem({ id: 7, inicioPrevisto: new Date("2026-07-12T08:00:00"), fimPrevisto: new Date("2026-07-12T18:00:00") }),
      avisoInterjornada: null,
    }
    const tx = criarTx([motoristaDoBanco([finalizadaComAvisoAntigo, canceladaComAvisoAntigo, semMudanca])])

    await recalcularAvisosInterjornada(tx as never, FILIAL_ID, [1], agora)

    expect(tx.viagem.update).not.toHaveBeenCalled()
  })
})
