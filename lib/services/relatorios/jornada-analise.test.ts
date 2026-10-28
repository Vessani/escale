import { describe, expect, it } from "vitest"
import type { ViagemCircadiano } from "@/lib/services/circadiano.service"
import {
  ciclosDe72h,
  estourosDeJornada,
  folgasSemanaisCurtas,
  juntarEstourosSetimoDia,
  painelPorMotorista,
  quebrasDeIntersticio,
  type AutorizacaoEstouro,
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

  const aprovado = (criadoEm: string, extra: Partial<AutorizacaoEstouro> = {}): AutorizacaoEstouro => ({
    id: 1,
    motoristaId: 1,
    criadoEm: h(criadoEm),
    decididoEm: h(criadoEm),
    decididoPorNome: "Roberto",
    minutosExtras: 90,
    motivos: ["TRANSITO_LENTO"],
    pedidoPeloMotorista: true,
    ...extra,
  })

  it("mostra quem autorizou: o pedido aprovado durante a jornada", () => {
    const jornadas = [jornada(1, "2026-09-10T06:00:00", "2026-09-10T19:30:00")]
    const [estouro] = estourosDeJornada([jose], jornadas, [], de, ate, 12, [aprovado("2026-09-10T16:00:00")])
    expect(estouro.autorizacoes).toEqual([expect.objectContaining({ decididoPorNome: "Roberto", minutosExtras: 90 })])
  })

  it("pedido feito antes de começar vale pra próxima jornada (até 12h antes), não pra outra", () => {
    const jornadas = [jornada(1, "2026-09-10T06:00:00", "2026-09-10T19:30:00"), jornada(1, "2026-09-11T06:00:00", "2026-09-11T19:30:00")]
    const [dia11, dia10] = estourosDeJornada([jose], jornadas, [], de, ate, 12, [aprovado("2026-09-10T22:00:00")])
    expect(dia11.inicio).toEqual(h("2026-09-11T06:00:00"))
    expect(dia11.autorizacoes).toHaveLength(1)
    expect(dia10.autorizacoes).toEqual([])
    // Mais de 12h antes não vale pra ninguém.
    expect(
      estourosDeJornada([jose], jornadas, [], de, ate, 12, [aprovado("2026-09-09T17:00:00")]).every((e) => e.autorizacoes.length === 0),
    ).toBe(true)
  })

  it("pedido de outro motorista não autoriza", () => {
    const jornadas = [jornada(1, "2026-09-10T06:00:00", "2026-09-10T19:30:00")]
    const [estouro] = estourosDeJornada([jose], jornadas, [], de, ate, 12, [aprovado("2026-09-10T16:00:00", { motoristaId: 2 })])
    expect(estouro.autorizacoes).toEqual([])
  })
})

describe("ciclosDe72h", () => {
  /** n jornadas seguidas de `horas` cada, começando às 06:00 a partir do dia `diaInicial` de setembro. */
  const dias = (diaInicial: number, n: number, horas: number) =>
    Array.from({ length: n }, (_, i) => {
      const dia = String(diaInicial + i).padStart(2, "0")
      const fim = String(6 + horas).padStart(2, "0")
      return jornada(1, `2026-09-${dia}T06:00:00`, `2026-09-${dia}T${fim}:00:00`)
    })

  it("soma as jornadas desde a última folga de 35h e diz quando passou das 72h", () => {
    // 7 dias de 11h = 77h; passa das 72h no 7º dia, depois de 6h de jornada (66h + 6h).
    const [ciclo, ...resto] = ciclosDe72h([jose], dias(1, 7, 11), [], de, ate)
    expect(resto).toHaveLength(0)
    expect(ciclo).toMatchObject({
      jornadas: 7,
      horasMinutos: 77 * 60,
      excedenteMinutos: 5 * 60,
      faltamMinutos: 0,
      passouEm: h("2026-09-07T12:00:00"),
      inicio: h("2026-09-01T06:00:00"),
      fim: h("2026-09-07T17:00:00"),
    })
  })

  it("folga de 35h ou mais zera a conta; folga menor não", () => {
    // Dias 1 a 4 e 6 a 9, 12h cada; dia 04 18:00 → dia 06 06:00 = 36h de folga → zera a conta.
    const comFolga = [...dias(1, 4, 12), ...dias(6, 4, 12)]
    expect(ciclosDe72h([jose], comFolga, [], de, ate, { alertaHoras: 48 }).map((c) => c.horasMinutos)).toEqual([48 * 60, 48 * 60])

    // Dia 04 18:00 → dia 06 04:00 = 34h: não é folga de 35h, segue o mesmo ciclo (96h).
    const folgaCurta = [...dias(1, 4, 12), jornada(1, "2026-09-06T04:00:00", "2026-09-06T16:00:00"), ...dias(7, 3, 12)]
    const [ciclo] = ciclosDe72h([jose], folgaCurta, [], de, ate)
    expect(ciclo.horasMinutos).toBe(96 * 60)
    expect(ciclo.jornadas).toBe(8)
  })

  it("só entra quem passou do alerta (60h por padrão)", () => {
    expect(ciclosDe72h([jose], dias(1, 5, 11), [], de, ate)).toEqual([]) // 55h
    expect(ciclosDe72h([jose], dias(1, 5, 12), [], de, ate)).toEqual([
      expect.objectContaining({ horasMinutos: 60 * 60, faltamMinutos: 12 * 60 }),
    ])
  })

  it("encerrado = já folgou 35h: tem jornada depois, ou o relatório de jornada cobre a folga inteira", () => {
    const ciclo = dias(1, 6, 12) // termina dia 06 às 18:00
    expect(ciclosDe72h([jose], ciclo, [], de, ate)[0].encerrado).toBe(false)
    // Importado até o dia 07: dia 06 18:00 → fim do dia 07 = 30h, a folga ainda não coube.
    expect(ciclosDe72h([jose], ciclo, [], de, ate, { coberturaAte: h("2026-09-07T00:00:00") })[0].encerrado).toBe(false)
    // Importado até o dia 08: 54h sem jornada, folgou.
    expect(ciclosDe72h([jose], ciclo, [], de, ate, { coberturaAte: h("2026-09-08T00:00:00") })[0].encerrado).toBe(true)
    expect(ciclosDe72h([jose], [...ciclo, ...dias(9, 1, 8)], [], de, ate)[0].encerrado).toBe(true)
  })

  it("ciclo que começou antes do período entra inteiro; o que acabou antes, não", () => {
    const periodo = { de: h("2026-09-05T00:00:00"), ate }
    const [ciclo] = ciclosDe72h([jose], dias(1, 6, 12), [], periodo.de, periodo.ate)
    expect(ciclo.horasMinutos).toBe(72 * 60)
    expect(ciclosDe72h([jose], dias(1, 6, 12), [], h("2026-09-10T00:00:00"), ate)).toEqual([])
  })

  it("junta os estouros autorizados de todas as jornadas do ciclo", () => {
    const autorizacoes: AutorizacaoEstouro[] = [
      {
        id: 1,
        motoristaId: 1,
        criadoEm: h("2026-09-02T15:00:00"),
        decididoEm: null,
        decididoPorNome: "Roberto",
        minutosExtras: 60,
        motivos: ["ABASTECER"],
        pedidoPeloMotorista: true,
      },
      {
        id: 2,
        motoristaId: 1,
        criadoEm: h("2026-09-05T15:00:00"),
        decididoEm: null,
        decididoPorNome: "Carla",
        minutosExtras: 120,
        motivos: ["CHEGAR_CDL"],
        pedidoPeloMotorista: false,
      },
    ]
    const [ciclo] = ciclosDe72h([jose], dias(1, 6, 12), [], de, ate, { autorizacoes })
    expect(ciclo.autorizacoes.map((a) => a.decididoPorNome)).toEqual(["Roberto", "Carla"])
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
