import { describe, expect, it } from "vitest"
import type { ViagemCircadiano } from "@/lib/services/circadiano.service"
import {
  estourosDeJornada,
  folgasSemanaisCurtas,
  juntarEstourosSetimoDia,
  painelPorMotorista,
  quebrasDeIntersticio,
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

describe("quebrasDeIntersticio", () => {
  it("pega descanso menor que 11h, com a viagem da jornada seguinte", () => {
    const [ocorrencia, ...resto] = quebrasDeIntersticio(
      [jose],
      [jornada(1, "2026-09-10T08:00:00", "2026-09-10T22:00:00"), jornada(1, "2026-09-11T05:00:00", "2026-09-11T15:00:00")],
      [viagem],
      de,
      ate,
    )

    expect(resto).toHaveLength(0)
    expect(ocorrencia).toMatchObject({
      descansoMinutos: 7 * 60,
      faltaramMinutos: 4 * 60,
      atividade: "VIAGEM",
      numViagem: "922100",
    })
  })

  it("só olha as 11h — folga de 28h depois do 6º dia não é quebra de interstício (vai pro estouro de 7º dia)", () => {
    expect(
      quebrasDeIntersticio(
        [jose],
        [
          jornada(1, "2026-09-10T06:00:00", "2026-09-10T16:00:00", { diasSemFolga: 6, codigo: 6 }),
          jornada(1, "2026-09-11T20:00:00", "2026-09-12T06:00:00", { diasSemFolga: 1 }),
        ],
        [],
        de,
        ate,
      ),
    ).toHaveLength(0)
  })

  it("não acusa descanso suficiente, motoristas diferentes nem jornada seguinte fora do período", () => {
    expect(
      quebrasDeIntersticio(
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

describe("estouro de 7º dia", () => {
  it("folga menor que 35h depois do 6º dia", () => {
    const curtas = folgasSemanaisCurtas(
      [jose],
      [
        jornada(1, "2026-09-10T06:00:00", "2026-09-10T16:00:00", { diasSemFolga: 6, codigo: 6 }),
        jornada(1, "2026-09-11T20:00:00", "2026-09-12T06:00:00", { diasSemFolga: 1 }),
      ],
      [],
      de,
      ate,
    )
    expect(curtas).toHaveLength(1)
    expect(curtas[0]).toMatchObject({ folgaMinutos: 28 * 60, faltaramMinutos: 7 * 60, atividade: "INTERNO" })
  })

  it("se seguiu pro 7º dia, não repete como folga curta — entra só como 7º dia trabalhado", () => {
    expect(
      folgasSemanaisCurtas(
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

  it("folga de 35h ou mais está ok", () => {
    expect(
      folgasSemanaisCurtas(
        [jose],
        [
          jornada(1, "2026-09-10T06:00:00", "2026-09-10T16:00:00", { diasSemFolga: 6, codigo: 6 }),
          jornada(1, "2026-09-12T03:00:00", "2026-09-12T13:00:00", { diasSemFolga: 1 }),
        ],
        [],
        de,
        ate,
      ),
    ).toHaveLength(0)
  })

  it("junta 7º dia trabalhado e folga curta numa lista, mais recentes primeiro", () => {
    const setimo = {
      motoristaId: 2,
      motorista: "ANA",
      turno: "NOITE" as const,
      dia: h("2026-09-05T00:00:00"),
      diasSemFolga: 7,
      inicio: h("2026-09-05T19:00:00"),
      fim: h("2026-09-06T05:00:00"),
      atividade: "INTERNO" as const,
      numViagem: null,
      cavalo: null,
      carreta: null,
    }
    const curtas = folgasSemanaisCurtas(
      [jose],
      [
        jornada(1, "2026-09-10T06:00:00", "2026-09-10T16:00:00", { diasSemFolga: 6, codigo: 6 }),
        jornada(1, "2026-09-11T20:00:00", "2026-09-12T06:00:00", { diasSemFolga: 1 }),
      ],
      [],
      de,
      ate,
    )

    const estouros = juntarEstourosSetimoDia([setimo], curtas)
    expect(estouros.map((e) => [e.motorista, e.tipo])).toEqual([
      ["JOSE", "FOLGA_CURTA"],
      ["ANA", "SETIMO_DIA"],
    ])
    expect(estouros[0]).toMatchObject({ dia: h("2026-09-11T00:00:00"), fimAnterior: h("2026-09-10T16:00:00"), diasSemFolga: null })
    expect(estouros[1]).toMatchObject({ diasSemFolga: 7, folgaMinutos: null })
  })
})

describe("estourosDeJornada", () => {
  it("passa do limite escolhido", () => {
    const jornadas = [jornada(1, "2026-09-10T06:00:00", "2026-09-10T19:30:00"), jornada(1, "2026-09-11T06:00:00", "2026-09-11T17:00:00")]

    expect(estourosDeJornada([jose], jornadas, [], de, ate)).toEqual([
      expect.objectContaining({ duracaoMinutos: 13 * 60 + 30, excedenteMinutos: 90 }),
    ])
    expect(estourosDeJornada([jose], jornadas, [], de, ate, 10)).toHaveLength(2)
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
      estourosSetimoDia: 1,
      quebrasIntersticio: 1,
      estourosJornada: 1,
      totalAlertas: 4,
    })
    expect(linhas[1]).toMatchObject({ motorista: "ANA", diasTrabalhados: 1, viagens: 1, totalAlertas: 0 })
  })

  it("folga menor que 35h conta como estouro de 7º dia, não como quebra de interstício", () => {
    const [linha] = painelPorMotorista(
      [jose],
      [
        jornada(1, "2026-09-10T06:00:00", "2026-09-10T16:00:00", { diasSemFolga: 6, codigo: 6 }),
        jornada(1, "2026-09-11T20:00:00", "2026-09-12T06:00:00", { diasSemFolga: 1 }),
      ],
      [],
      de,
      ate,
    )
    expect(linha).toMatchObject({ estourosSetimoDia: 1, quebrasIntersticio: 0 })
  })
})
