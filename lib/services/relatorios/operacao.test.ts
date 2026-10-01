import { describe, expect, it } from "vitest"
import {
  SEM_MOTIVO,
  analisarPontualidade,
  integracoesVencendo,
  listarAvisos,
  textoVencimento,
  usoDaFrota,
  type ViagemPontualidade,
} from "./operacao"
import { periodoOuPadrao, resolverPeriodo, diasNoPeriodo } from "@/lib/relatorios/periodo"
import { formatarDuracao } from "@/lib/relatorios/formato"
import { parseDiasIntegracao, parseHorasJornadaLonga } from "@/lib/relatorios/catalogo"

const h = (iso: string) => new Date(`${iso}-03:00`)
const dia = (iso: string) => h(`${iso}T00:00:00`)

describe("integracoesVencendo", () => {
  const base = { motorista: "JOSE", motoristaId: 1, cliente: "WHITE MARTINS", status: "ATIVO" as const }

  it("classifica, filtra pela janela e põe vencidas primeiro", () => {
    const lista = integracoesVencendo(
      [
        { ...base, cliente: "C", dataValidade: dia("2026-10-20") },
        { ...base, cliente: "A", dataValidade: dia("2026-09-28") },
        { ...base, cliente: "B", dataValidade: dia("2026-10-03") },
        { ...base, cliente: "D", dataValidade: dia("2026-12-01") },
      ],
      h("2026-09-30T15:00:00"),
      30,
    )

    expect(lista.map((item) => [item.cliente, item.situacao, item.diasParaVencer])).toEqual([
      ["A", "VENCIDA", -2],
      ["B", "URGENTE", 3],
      ["C", "VENCENDO", 20],
    ])
    expect(textoVencimento(-2)).toBe("Venceu há 2 dias")
    expect(textoVencimento(0)).toBe("Vence hoje")
    expect(textoVencimento(1)).toBe("Vence amanhã")
  })
})

describe("analisarPontualidade", () => {
  function viagem(id: number, atrasoMin: number | null, parcial: Partial<ViagemPontualidade> = {}): ViagemPontualidade {
    const inicio = h("2026-09-10T08:00:00")
    return {
      id,
      numViagem: String(id),
      status: "FINALIZADA",
      inicioPrevisto: inicio,
      horarioRealSaida: atrasoMin === null ? null : new Date(inicio.getTime() + atrasoMin * 60_000),
      motivoAtraso: null,
      motorista: { id: 1, nome: "JOSE" },
      clientes: ["AIR LIQUIDE"],
      ...parcial,
    }
  }

  it("tolerância de 15 min, agrupa por motivo/motorista/cliente e conta saídas sem registro", () => {
    const resultado = analisarPontualidade([
      viagem(1, 10),
      viagem(2, 40, { motivoAtraso: "  frota  atrasada " }),
      viagem(3, 80, { motivoAtraso: "Frota atrasada", motorista: { id: 2, nome: "ANA" }, clientes: ["AIR LIQUIDE", "LINDE"] }),
      viagem(4, 20),
      viagem(5, null),
      viagem(6, null, { status: "ALOCADA" }),
      viagem(7, -5),
    ])

    expect(resultado).toMatchObject({
      saidasRegistradas: 5,
      semRegistro: 1,
      noHorario: 2,
      atrasadas: 3,
      atrasoMedioMinutos: 47,
      maiorAtrasoMinutos: 80,
    })
    expect(resultado.percentualNoHorario).toBeCloseTo(0.4)
    expect(resultado.porMotivo).toEqual([
      { motivo: "Frota atrasada", quantidade: 2, atrasoMedioMinutos: 60 },
      { motivo: SEM_MOTIVO, quantidade: 1, atrasoMedioMinutos: 20 },
    ])
    expect(resultado.porMotorista.map((grupo) => [grupo.nome, grupo.saidas, grupo.atrasadas])).toEqual([
      ["JOSE", 4, 2],
      ["ANA", 1, 1],
    ])
    expect(resultado.porCliente.find((grupo) => grupo.nome === "LINDE")).toMatchObject({ saidas: 1, atrasadas: 1 })
    expect(resultado.listaAtrasos.map((atraso) => atraso.id)).toEqual(expect.arrayContaining([2, 3, 4]))
  })

  it("sem saídas não divide por zero", () => {
    expect(analisarPontualidade([])).toMatchObject({ percentualNoHorario: 0, atrasoMedioMinutos: 0, maiorAtrasoMinutos: 0 })
  })
})

describe("listarAvisos", () => {
  it("lista só os avisos preenchidos", () => {
    expect(
      listarAvisos({
        avisoInterjornada: "Interjornada: 5h",
        avisoFrotaIndisponivel: null,
        avisoFrotaProdutoIncompativel: "Outro produto",
        avisoRelatorioJornada: null,
      }).map((aviso) => aviso.rotulo),
    ).toEqual(["Descanso", "Frota de outro produto"])
  })
})

describe("usoDaFrota", () => {
  const frota = (id: number, carreta: string) => ({ id, cavalo: `C${id}`, carreta, emManutencao: false, tipoProduto: null })
  const viagem = (carreta: string, inicio: string, fim: string, status: "FINALIZADA" | "CANCELADA" = "FINALIZADA") => ({
    id: Math.random(),
    carreta,
    status,
    inicioPrevisto: h(inicio),
    fimPrevisto: h(fim),
    finalizadoEm: null,
  })

  it("conta dias de calendário recortados ao período; parados primeiro", () => {
    const de = dia("2026-09-01")
    const ate = h("2026-09-10T23:59:59")
    const uso = usoDaFrota(
      [frota(1, "908"), frota(2, "777")],
      [
        viagem("908", "2026-08-31T20:00:00", "2026-09-02T10:00:00"),
        viagem("908", "2026-09-05T08:00:00", "2026-09-05T18:00:00"),
        viagem("908", "2026-09-07T08:00:00", "2026-09-08T18:00:00", "CANCELADA"),
      ],
      de,
      ate,
      new Map([["777", dia("2026-07-15")]]),
    )

    expect(uso[0]).toMatchObject({ carreta: "777", viagens: 0, diasOcupados: 0, ocupacao: 0, ultimaViagem: dia("2026-07-15") })
    expect(uso[1]).toMatchObject({ carreta: "908", viagens: 1, diasOcupados: 3 })
    expect(uso[1].ocupacao).toBeCloseTo(0.3)
  })
})

describe("período, formato e parâmetros", () => {
  it("resolve período padrão, mês atual e recusa inválidos", () => {
    const agora = h("2026-09-30T21:00:00")
    expect(resolverPeriodo(undefined, undefined, "MES_ATUAL", agora)).toMatchObject({ deTexto: "2026-09-01", ateTexto: "2026-09-30" })
    expect(resolverPeriodo(undefined, undefined, { diasAntes: 30, diasDepois: 0 }, agora)).toMatchObject({ deTexto: "2026-08-31" })
    expect(resolverPeriodo("2026-09-10", "2026-09-01", "MES_ATUAL", agora)).toBeNull()
    expect(periodoOuPadrao("lixo", undefined, "MES_ATUAL", agora).deTexto).toBe("2026-09-01")
    expect(diasNoPeriodo(resolverPeriodo("2026-09-01", "2026-09-30", "MES_ATUAL", agora)!)).toBe(30)
  })

  it("formata duração e só aceita as opções da tela", () => {
    expect(formatarDuracao(680)).toBe("11h20")
    expect(formatarDuracao(45)).toBe("45 min")
    expect(parseHorasJornadaLonga("13")).toBe(13)
    expect(parseHorasJornadaLonga("99")).toBe(12)
    expect(parseDiasIntegracao("60")).toBe(60)
    expect(parseDiasIntegracao(null)).toBe(30)
  })
})
