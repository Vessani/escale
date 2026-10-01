import { describe, expect, it } from "vitest"
import {
  SEM_MOTIVO,
  analisarPontualidade,
  integracoesVencendo,
  listarAvisos,
  textoVencimento,
  disponibilidadeDaFrota,
  type ViagemPontualidade,
} from "./operacao"
import { periodoOuPadrao, resolverPeriodo, diasNoPeriodo } from "@/lib/relatorios/periodo"
import { formatarDuracao, formatarDuracaoLonga } from "@/lib/relatorios/formato"
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

describe("disponibilidadeDaFrota", () => {
  const de = dia("2026-09-01")
  const ate = h("2026-09-10T23:59:59")
  const agora = h("2026-10-01T00:00:00")
  const carreta = { veiculo: "CARRETA" as const, codigo: "908", conjunto: "75 / 908" }
  const cavalo = { veiculo: "CAVALO" as const, codigo: "75", conjunto: "75 / 908" }
  const viagem = (inicio: string, fim: string, parcial: Record<string, unknown> = {}) => ({
    id: Math.random(),
    cavalo: "75",
    carreta: "908",
    status: "FINALIZADA" as const,
    inicioPrevisto: h(inicio),
    fimPrevisto: h(fim),
    finalizadoEm: null,
    horarioRealSaida: null,
    ...parcial,
  })
  const manutencao = (parcial: Record<string, unknown>) => ({
    id: 1,
    veiculo: "CARRETA" as const,
    codigo: "908",
    tipo: "PREVENTIVA" as const,
    nivel: "A" as const,
    responsavel: "WHITE_MARTINS" as const,
    inicioPrevisto: h("2026-09-05T08:00:00"),
    fimPrevisto: h("2026-09-05T18:00:00"),
    inicioReal: null,
    fimReal: h("2026-09-05T20:00:00"),
    ...parcial,
  })

  it("divide o período em rota, manutenção por responsável e disponível; manutenção vence rota", () => {
    const [item] = disponibilidadeDaFrota(
      [carreta],
      [
        viagem("2026-09-02T08:00:00", "2026-09-02T18:00:00", { horarioRealSaida: h("2026-09-02T09:00:00") }),
        viagem("2026-09-05T16:00:00", "2026-09-05T22:00:00"),
        viagem("2026-09-07T08:00:00", "2026-09-07T18:00:00", { status: "CANCELADA" }),
      ],
      [manutencao({}), manutencao({ id: 2, responsavel: "RITMO", inicioPrevisto: h("2026-09-08T00:00:00"), fimPrevisto: null, fimReal: h("2026-09-08T06:00:00") })],
      de,
      ate,
      agora,
    )

    expect(item.minutosPeriodo).toBe(10 * 24 * 60)
    // 9h (saída real 09:00 → 18:00) + 2h (20:00 → 22:00, o resto da viagem caiu na manutenção).
    expect(item.minutosEmRota).toBe(11 * 60)
    expect(item.minutosManutencaoWhiteMartins).toBe(12 * 60)
    expect(item.minutosManutencaoRitmo).toBe(6 * 60)
    expect(item.minutosDisponivelParado).toBe(10 * 24 * 60 - 29 * 60)
    expect(item.disponibilidade).toBeCloseTo(1 - (18 * 60) / (10 * 24 * 60))
    expect(item.viagens).toBe(2)
    expect(item.manutencoes).toBe(2)
  })

  it("só conta até agora, e manutenção em aberto vai até agora", () => {
    const [item] = disponibilidadeDaFrota(
      [cavalo],
      [],
      [manutencao({ veiculo: "CAVALO", codigo: "75", fimReal: null, fimPrevisto: null, inicioPrevisto: h("2026-09-09T00:00:00") })],
      de,
      ate,
      h("2026-09-10T00:00:00"),
    )
    expect(item.minutosPeriodo).toBe(9 * 24 * 60)
    expect(item.minutosManutencaoWhiteMartins).toBe(24 * 60)
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
    expect(formatarDuracaoLonga(4130)).toBe("2d 20h50")
    expect(formatarDuracaoLonga(2880)).toBe("2d")
    expect(formatarDuracaoLonga(90)).toBe("1h30")
    expect(parseHorasJornadaLonga("13")).toBe(13)
    expect(parseHorasJornadaLonga("99")).toBe(12)
    expect(parseDiasIntegracao("60")).toBe(60)
    expect(parseDiasIntegracao(null)).toBe(30)
  })
})
