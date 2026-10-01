import { describe, expect, it } from "vitest"
import type { ViagemCircadiano } from "@/lib/services/circadiano.service"
import {
  descansosDescumpridos,
  jornadasLongas,
  painelPorMotorista,
  type JornadaReal,
  type MotoristaJornada,
} from "./jornada-analise"

const h = (iso: string) => new Date(`${iso}-03:00`)
const de = h("2026-09-01T00:00:00")
const ate = h("2026-09-30T23:59:59")

const jose: MotoristaJornada = { id: 1, nome: "JOSE", turno: "MANHA", tipo: "MOTORISTA" }
const ana: MotoristaJornada = { id: 2, nome: "ANA", turno: "NOITE", tipo: "MOTORISTA" }

function jornada(motoristaId: number, inicio: string, fim: string, extra: Partial<JornadaReal> = {}): JornadaReal {
  return { motoristaId, inicioJornada: h(inicio), fimJornada: h(fim), codigo: 1, diasSemFolga: 1, ...extra }
}

const viagem: ViagemCircadiano = {
  id: 9,
  numViagem: "922100",
  cavalo: "2064",
  carreta: "908",
  status: "FINALIZADA",
  inicioPrevisto: h("2026-09-11T05:00:00"),
  fimPrevisto: h("2026-09-11T16:00:00"),
  finalizadoEm: null,
  motoristaId: 1,
  motoristaAcompanhanteId: null,
}

describe("descansosDescumpridos", () => {
  it("pega descanso menor que 11h, com a viagem da jornada seguinte", () => {
    const [ocorrencia, ...resto] = descansosDescumpridos(
      [jose],
      [jornada(1, "2026-09-10T08:00:00", "2026-09-10T22:00:00"), jornada(1, "2026-09-11T05:00:00", "2026-09-11T15:00:00")],
      [viagem],
      de,
      ate,
    )

    expect(resto).toHaveLength(0)
    expect(ocorrencia).toMatchObject({
      tipo: "INTERJORNADA",
      descansoMinutos: 7 * 60,
      minimoHoras: 11,
      faltaramMinutos: 4 * 60,
      atividade: "VIAGEM",
      numViagem: "922100",
    })
  })

  it("depois do 6º dia exige 35h", () => {
    const ocorrencias = descansosDescumpridos(
      [jose],
      [
        jornada(1, "2026-09-10T06:00:00", "2026-09-10T16:00:00", { diasSemFolga: 6, codigo: 6 }),
        jornada(1, "2026-09-11T20:00:00", "2026-09-12T06:00:00", { diasSemFolga: 1 }),
      ],
      [],
      de,
      ate,
    )
    expect(ocorrencias).toHaveLength(1)
    expect(ocorrencias[0]).toMatchObject({ tipo: "SEMANAL", minimoHoras: 35, descansoMinutos: 28 * 60, atividade: "INTERNO" })
  })

  it("7º dia seguido não vira também 'descanso semanal' — fica só em dias sem folga", () => {
    expect(
      descansosDescumpridos(
        [jose],
        [
          jornada(1, "2026-09-10T06:00:00", "2026-09-10T16:00:00", { diasSemFolga: 6, codigo: 6 }),
          jornada(1, "2026-09-11T06:00:00", "2026-09-11T16:00:00", { diasSemFolga: 7, codigo: 6 }),
        ],
        [],
        de,
        ate,
      ),
    ).toHaveLength(0)
  })

  it("não acusa descanso suficiente, motoristas diferentes nem jornada seguinte fora do período", () => {
    expect(
      descansosDescumpridos(
        [jose, ana],
        [
          jornada(1, "2026-09-10T06:00:00", "2026-09-10T16:00:00"),
          jornada(1, "2026-09-11T06:00:00", "2026-09-11T16:00:00"),
          jornada(2, "2026-09-11T08:00:00", "2026-09-11T18:00:00"),
          jornada(1, "2026-08-31T06:00:00", "2026-08-31T22:00:00"),
          jornada(1, "2026-08-31T23:00:00", "2026-09-01T03:00:00"),
        ],
        [],
        h("2026-09-02T00:00:00"),
        ate,
      ),
    ).toHaveLength(0)
  })
})

describe("jornadasLongas", () => {
  it("passa do limite escolhido", () => {
    const jornadas = [jornada(1, "2026-09-10T06:00:00", "2026-09-10T19:30:00"), jornada(1, "2026-09-11T06:00:00", "2026-09-11T17:00:00")]

    expect(jornadasLongas([jose], jornadas, [], de, ate)).toEqual([
      expect.objectContaining({ duracaoMinutos: 13 * 60 + 30, excedenteMinutos: 90 }),
    ])
    expect(jornadasLongas([jose], jornadas, [], de, ate, 10)).toHaveLength(2)
  })
})

describe("painelPorMotorista", () => {
  it("soma trabalho, viagens e alertas; quem tem alerta vem primeiro", () => {
    const linhas = painelPorMotorista(
      [ana, jose],
      [
        jornada(1, "2026-09-10T08:00:00", "2026-09-10T23:00:00"),
        jornada(1, "2026-09-11T05:00:00", "2026-09-11T15:00:00", { diasSemFolga: 7 }),
        jornada(2, "2026-09-10T19:00:00", "2026-09-11T04:00:00"),
      ],
      [viagem, { ...viagem, id: 10, motoristaId: 2, motoristaAcompanhanteId: 1 }, { ...viagem, id: 11, status: "CANCELADA" }],
      de,
      ate,
    )

    expect(linhas[0]).toMatchObject({
      motorista: "JOSE",
      diasTrabalhados: 2,
      horasTrabalhadasMinutos: 25 * 60,
      maiorJornadaMinutos: 15 * 60,
      viagens: 2,
      circadiano: 1,
      diasSemFolgaEstourados: 1,
      descansosDescumpridos: 1,
      jornadasLongas: 1,
      totalAlertas: 4,
    })
    expect(linhas[1]).toMatchObject({ motorista: "ANA", diasTrabalhados: 1, viagens: 1, totalAlertas: 0 })
  })
})
