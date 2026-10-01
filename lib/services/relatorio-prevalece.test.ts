import { describe, expect, it, vi } from "vitest"
import type { StatusViagem } from "@prisma/client"

vi.mock("@/lib/prisma", () => ({ prisma: {} }))

import {
  calcularAvisoDescanso,
  calcularDescansoAntesDaViagem,
  motoristaEstaDisponivelNoPeriodo,
  viagemDesmentidaPeloRelatorio,
} from "@/lib/services/alocacao.service"
import { AVISO_VIAGEM_DESMENTIDA, recalcularAvisosInterjornada } from "@/lib/services/interjornada.service"
import { prepararJornadaDoMotorista } from "@/lib/services/jornada.service"
import { inicioDoDia } from "@/lib/utils/date-format"

// Caso do Nunes: o relatório de jornada (importado até ontem, 29/09) mostra
// que ele trabalhou até 27/09 e não trabalhou 28 nem 29. No Escale ficou uma
// viagem "Alocada" pra ele em 29/09 que não aconteceu. Hoje, 30/09, é o
// primeiro dia dele — não pode dar aviso de interjornada por causa dela.

const dia = (iso: string) => inicioDoDia(new Date(`${iso}T12:00:00-03:00`))
const hora = (iso: string) => new Date(`${iso}-03:00`)
const hoje = dia("2026-09-30")

function viagem(id: number, inicio: string, fim: string, status: StatusViagem = "ALOCADA") {
  return { id, inicioPrevisto: hora(inicio), fimPrevisto: hora(fim), status, deletadoEm: null, finalizadoEm: null }
}

/** Dias trabalhados segundo o relatório (com horário real), 21 a 27/09. */
function registrosAte27() {
  return [21, 22, 23, 24, 25, 26, 27].map((d, i) => ({
    data: dia(`2026-09-${d}`),
    codigo: (i % 5) + 1,
    fimJornada: hora(`2026-09-${d}T17:00:00`),
  }))
}

const viagemFantasma = viagem(10, "2026-09-29T08:00:00", "2026-09-29T20:00:00")
const viagemDeHoje = viagem(11, "2026-09-30T05:00:00", "2026-09-30T15:00:00")

function nunes(parcial: Record<string, unknown> = {}) {
  return {
    id: 1,
    nome: "Nunes",
    turno: "MANHA" as const,
    diasTrabalhados: 1,
    tipo: "MOTORISTA" as const,
    integracao: [],
    jornadaRelatorioInicio: null,
    jornadaRelatorioFim: null,
    produtosAutorizados: [],
    registrosJornada: registrosAte27(),
    relatorioJornadaAte: dia("2026-09-29"),
    viagens: [viagemFantasma],
    ...parcial,
  }
}

describe("Relatório de Jornada prevalece sobre viagem do Escale", () => {
  it("viagem em dia coberto pelo relatório, sem o motorista trabalhando, não conta pro descanso", () => {
    const motorista = nunes()

    expect(viagemDesmentidaPeloRelatorio(motorista, viagemFantasma)).toBe(true)
    const descanso = calcularDescansoAntesDaViagem(motorista, viagemDeHoje.inicioPrevisto, hoje, viagemDeHoje.id)
    expect(descanso?.fimTrabalhoAnterior).toEqual(hora("2026-09-27T17:00:00"))
    expect(calcularAvisoDescanso(motorista, viagemDeHoje, hoje)).toBeNull()
  })

  it("sem a regra (relatório não cobre o dia 29), a viagem do Escale ainda conta e gera o aviso", () => {
    const motorista = nunes({ relatorioJornadaAte: dia("2026-09-28") })

    expect(viagemDesmentidaPeloRelatorio(motorista, viagemFantasma)).toBe(false)
    expect(calcularAvisoDescanso(motorista, viagemDeHoje, hoje)).toMatch(/Interjornada/)
  })

  it("se o relatório mostra trabalho em algum dia da viagem, ela continua valendo", () => {
    const motorista = nunes({
      registrosJornada: [...registrosAte27(), { data: dia("2026-09-29"), codigo: 1, fimJornada: hora("2026-09-29T19:00:00") }],
    })

    expect(viagemDesmentidaPeloRelatorio(motorista, viagemFantasma)).toBe(false)
  })

  it("motorista que não aparece no relatório antes da viagem não tem a viagem desmentida", () => {
    expect(viagemDesmentidaPeloRelatorio(nunes({ registrosJornada: [] }), viagemFantasma)).toBe(false)

    // Edição manual do calendário (sem horário) não é evidência do relatório.
    const soManual = registrosAte27().map((registro) => ({ ...registro, fimJornada: null }))
    expect(viagemDesmentidaPeloRelatorio(nunes({ registrosJornada: soManual }), viagemFantasma)).toBe(false)
  })

  it("sem cobertura conhecida (filial nunca importou relatório), a regra fica desligada", () => {
    expect(viagemDesmentidaPeloRelatorio(nunes({ relatorioJornadaAte: null }), viagemFantasma)).toBe(false)
  })

  it("viagem desmentida também não ocupa a agenda na checagem de disponibilidade", () => {
    expect(
      motoristaEstaDisponivelNoPeriodo(nunes(), viagemDeHoje.inicioPrevisto, viagemDeHoje.fimPrevisto, hoje),
    ).toBe(true)
    expect(
      motoristaEstaDisponivelNoPeriodo(
        nunes({ relatorioJornadaAte: dia("2026-09-28") }),
        viagemDeHoje.inicioPrevisto,
        viagemDeHoje.fimPrevisto,
        hoje,
      ),
    ).toBe(false)
  })

  it("prepararJornadaDoMotorista converte a cobertura da coluna @db.Date pra meia-noite local", () => {
    const preparado = prepararJornadaDoMotorista({
      registrosJornada: [],
      filial: { relatorioJornadaAte: new Date("2026-09-29T00:00:00.000Z") },
    })
    expect(preparado.relatorioJornadaAte).toEqual(dia("2026-09-29"))
    expect(prepararJornadaDoMotorista({ registrosJornada: [] }).relatorioJornadaAte).toBeNull()
  })

  it("recalcularAvisosInterjornada marca a viagem desmentida e limpa o aviso de descanso da seguinte", async () => {
    const registrosDoBanco = [21, 22, 23, 24, 25, 26, 27].map((d, i) => ({
      data: new Date(`2026-09-${d}T00:00:00.000Z`),
      codigo: (i % 5) + 1,
      fimJornada: hora(`2026-09-${d}T17:00:00`),
    }))
    const tx = {
      motorista: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: 1,
            diasTrabalhados: 1,
            filial: { relatorioJornadaAte: new Date("2026-09-29T00:00:00.000Z") },
            registrosJornada: registrosDoBanco,
            viagens: [
              { ...viagemFantasma, avisoInterjornada: null, avisoRelatorioJornada: null },
              { ...viagemDeHoje, avisoInterjornada: "Interjornada: motorista teve apenas 9.0h de descanso (mínimo 11h).", avisoRelatorioJornada: null },
            ],
            viagensComoAcompanhante: [],
          },
        ]),
      },
      viagem: { update: vi.fn() },
      $queryRaw: vi.fn().mockResolvedValue([]),
    }

    await recalcularAvisosInterjornada(tx as never, 1, [1], hora("2026-09-30T04:00:00"))

    expect(tx.viagem.update).toHaveBeenCalledWith({ where: { id: 10 }, data: { avisoRelatorioJornada: AVISO_VIAGEM_DESMENTIDA } })
    expect(tx.viagem.update).toHaveBeenCalledWith({ where: { id: 11 }, data: { avisoInterjornada: null } })
    expect(tx.viagem.update).toHaveBeenCalledTimes(2)
  })
})
