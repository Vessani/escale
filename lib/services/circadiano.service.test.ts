import { describe, expect, it } from "vitest"
import {
  formatarExcedente,
  limiteCircadiano,
  ocorrenciasPrevistas,
  ocorrenciasRealizadas,
  ordenarOcorrencias,
  type ViagemCircadiano,
} from "./circadiano.service"
import { PERIODO_PADRAO } from "@/lib/relatorios/catalogo"
import { resolverPeriodo } from "@/lib/relatorios/periodo"

const periodoCircadiano = (de?: string, ate?: string, agora?: Date) => resolverPeriodo(de, ate, PERIODO_PADRAO.circadiano, agora)

const h = (iso: string) => new Date(`${iso}-03:00`)

const jose = { id: 1, nome: "JOSE", turno: "MANHA" as const }
const ana = { id: 2, nome: "ANA", turno: "NOITE" as const }

function viagem(parcial: Partial<ViagemCircadiano>): ViagemCircadiano {
  return {
    id: 10,
    numViagem: "922100",
    cavalo: "2064",
    carreta: "908",
    status: "ALOCADA",
    inicioPrevisto: h("2026-10-02T11:00:00"),
    fimPrevisto: h("2026-10-03T08:00:00"),
    finalizadoEm: null,
    motoristaId: 1,
    motoristaAcompanhanteId: null,
    ...parcial,
  }
}

describe("limiteCircadiano", () => {
  it("dia: 22:00 do mesmo dia; noite: 05:00 seguinte (ou do mesmo dia, se começou de madrugada)", () => {
    expect(limiteCircadiano(h("2026-10-01T06:00:00"), "MANHA")).toEqual(h("2026-10-01T22:00:00"))
    expect(limiteCircadiano(h("2026-10-01T18:00:00"), "NOITE")).toEqual(h("2026-10-02T05:00:00"))
    expect(limiteCircadiano(h("2026-10-01T03:00:00"), "NOITE")).toEqual(h("2026-10-01T05:00:00"))
  })
})

describe("ocorrenciasRealizadas", () => {
  it("pega quem terminou depois do limite, com a viagem e a frota do horário", () => {
    const ocorrencias = ocorrenciasRealizadas(
      [jose, ana],
      [
        { motoristaId: 1, inicioJornada: h("2026-09-28T11:00:00"), fimJornada: h("2026-09-28T23:10:00") },
        { motoristaId: 1, inicioJornada: h("2026-09-29T06:00:00"), fimJornada: h("2026-09-29T21:59:00") },
        { motoristaId: 2, inicioJornada: h("2026-09-28T19:00:00"), fimJornada: h("2026-09-29T06:30:00") },
      ],
      [viagem({ inicioPrevisto: h("2026-09-28T11:00:00"), fimPrevisto: h("2026-09-29T02:00:00") })],
    )

    expect(ocorrencias).toHaveLength(2)
    expect(ocorrencias[0]).toMatchObject({
      tipo: "REALIZADO",
      motorista: "JOSE",
      minutosExcedidos: 70,
      atividade: "VIAGEM",
      numViagem: "922100",
      cavalo: "2064",
      carreta: "908",
    })
    expect(ocorrencias[1]).toMatchObject({ motorista: "ANA", minutosExcedidos: 90, atividade: "INTERNO", numViagem: null })
  })

  it("acompanhante também é 'em viagem'; viagem cancelada não conta", () => {
    const jornada = [{ motoristaId: 2, inicioJornada: h("2026-09-28T19:00:00"), fimJornada: h("2026-09-29T06:00:00") }]

    const comoAcompanhante = ocorrenciasRealizadas([ana], jornada, [
      viagem({ motoristaAcompanhanteId: 2, inicioPrevisto: h("2026-09-28T18:00:00"), fimPrevisto: h("2026-09-29T07:00:00") }),
    ])
    expect(comoAcompanhante[0].atividade).toBe("VIAGEM")

    const cancelada = ocorrenciasRealizadas([ana], jornada, [
      viagem({ motoristaId: 2, status: "CANCELADA", inicioPrevisto: h("2026-09-28T18:00:00"), fimPrevisto: h("2026-09-29T07:00:00") }),
    ])
    expect(cancelada[0].atividade).toBe("INTERNO")
  })
})

describe("ocorrenciasPrevistas", () => {
  it("viagem às 11:00 de motorista do dia → jornada prevista até 23:00, passa 1h", () => {
    const [ocorrencia] = ocorrenciasPrevistas([jose], [viagem({})], null)

    expect(ocorrencia).toMatchObject({ tipo: "PREVISTO", motorista: "JOSE", minutosExcedidos: 60, numViagem: "922100" })
    expect(ocorrencia.fim).toEqual(h("2026-10-02T23:00:00"))
  })

  it("viagem curta que acaba antes das 22:00 não entra", () => {
    expect(ocorrenciasPrevistas([jose], [viagem({ fimPrevisto: h("2026-10-02T21:00:00") })], null)).toHaveLength(0)
  })

  it("não repete o que o relatório já cobre, nem viagem finalizada, nem motorista fora do relatório", () => {
    expect(ocorrenciasPrevistas([jose], [viagem({})], h("2026-10-02T00:00:00"))).toHaveLength(0)
    expect(ocorrenciasPrevistas([jose], [viagem({})], h("2026-10-01T00:00:00"))).toHaveLength(1)
    expect(ocorrenciasPrevistas([jose], [viagem({ status: "FINALIZADA" })], null)).toHaveLength(0)
    expect(ocorrenciasPrevistas([ana], [viagem({})], null)).toHaveLength(0)
  })

  it("avisa também pelo acompanhante, cada um pelo seu turno", () => {
    const ocorrencias = ocorrenciasPrevistas(
      [jose, ana],
      [viagem({ motoristaAcompanhanteId: 2, inicioPrevisto: h("2026-10-02T20:00:00"), fimPrevisto: h("2026-10-03T09:00:00") })],
      null,
    )
    expect(ocorrencias.map((o) => [o.motorista, o.minutosExcedidos])).toEqual([
      ["JOSE", 10 * 60],
      ["ANA", 3 * 60],
    ])
  })
})

describe("ordenação, formato e período", () => {
  it("ordena e formata", () => {
    const [a, b] = ocorrenciasRealizadas(
      [jose],
      [
        { motoristaId: 1, inicioJornada: h("2026-09-27T11:00:00"), fimJornada: h("2026-09-27T23:00:00") },
        { motoristaId: 1, inicioJornada: h("2026-09-28T11:00:00"), fimJornada: h("2026-09-28T23:00:00") },
      ],
      [],
    )
    expect(ordenarOcorrencias([a, b])[0]).toBe(b)
    expect(ordenarOcorrencias([b, a], "proximas")[0]).toBe(a)
    expect(formatarExcedente(45)).toBe("45 min")
    expect(formatarExcedente(60)).toBe("1h")
    expect(formatarExcedente(75)).toBe("1h15")
  })

  it("período padrão de 7 dias pra trás e pra frente; recusa invertido ou longo demais", () => {
    const periodo = periodoCircadiano(undefined, undefined, h("2026-09-30T21:00:00"))
    expect(periodo).toMatchObject({ deTexto: "2026-09-23", ateTexto: "2026-10-07" })
    expect(periodoCircadiano("2026-10-05", "2026-10-01")).toBeNull()
    expect(periodoCircadiano("2026-01-01", "2026-12-31")).toBeNull()
    expect(periodoCircadiano("2026-02-30", "2026-03-01")).toBeNull()
  })
})
