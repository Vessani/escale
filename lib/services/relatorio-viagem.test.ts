import { describe, expect, it } from "vitest"
import { montarLinhaDoTempo, mudancasDeStatus } from "./relatorio-viagem"

const h = (hora: string) => new Date(`2026-10-02T${hora}:00-03:00`)
const rotulo = (s: string) => ({ ALOCADA: "Alocada", INICIADA: "Iniciada", FINALIZADA: "Finalizada", CRIADA: "Criada" })[s] ?? s

describe("mudancasDeStatus", () => {
  it("só as alterações que mudaram o status (criação inclusive)", () => {
    expect(
      mudancasDeStatus([
        { criadoEm: h("06:00"), antes: null, depois: { status: "ALOCADA" }, usuarioNome: "Alan" },
        { criadoEm: h("06:30"), antes: { status: "ALOCADA" }, depois: { status: "ALOCADA", cavalo: "2025" }, usuarioNome: "Alan" },
        { criadoEm: h("07:20"), antes: { status: "ALOCADA" }, depois: { status: "INICIADA" }, usuarioNome: "LUCIANO" },
      ]),
    ).toEqual([
      { quando: h("06:00"), de: null, para: "ALOCADA", quem: "Alan" },
      { quando: h("07:20"), de: "ALOCADA", para: "INICIADA", quem: "LUCIANO" },
    ])
  })
})

describe("montarLinhaDoTempo", () => {
  it("junta tudo em ordem de horário; no mesmo minuto, saída antes de troca/chegada e o fim por último", () => {
    const eventos = montarLinhaDoTempo({
      rotuloStatus: rotulo as never,
      mudancasStatus: [{ quando: h("07:20"), de: "ALOCADA", para: "INICIADA", quem: "LUCIANO" }],
      saida: { quando: h("07:20"), km: 152300, motivoAtraso: "Troca de frota" },
      chegadas: [{ quando: h("10:00"), cliente: "HOSPITAL", km: 152410, total: "452,4 m³" }],
      despesas: [{ quando: h("09:00"), tipo: "Pedágio", valor: "R$ 12,50" }],
      trocas: [{ quando: h("12:00"), de: "Luciano", para: "Hugo", km: 152450, local: "Curitiba", motivo: "Jornada" }],
      problema: { quando: h("11:00"), texto: "Pneu furado" },
      fim: { quando: h("18:00"), status: "FINALIZADA", km: 152780 },
    })
    expect(eventos.map((e) => `${e.tipo}:${e.titulo}`)).toEqual([
      "STATUS:Alocada → Iniciada",
      "SAIDA:Saída",
      "DESPESA:Pedágio",
      "CHEGADA:Chegada em HOSPITAL",
      "PROBLEMA:Problema mecânico",
      "TROCA:Troca de motorista: Luciano → Hugo",
      "FIM:Viagem encerrada",
    ])
    expect(eventos[1].detalhe).toBe("km 152.300 · atraso: Troca de frota")
    expect(eventos.at(-1)?.detalhe).toBe("km final 152.780")
  })

  it("no mesmo minuto, saída gravada com segundos vem antes da chegada digitada sem segundos", () => {
    const eventos = montarLinhaDoTempo({
      rotuloStatus: rotulo as never,
      mudancasStatus: [],
      saida: { quando: new Date(h("15:21").getTime() + 18_000), km: 1, motivoAtraso: null },
      chegadas: [{ quando: h("15:21"), cliente: "X", km: 2, total: "1 m³" }],
      despesas: [],
      trocas: [],
      problema: null,
      fim: null,
    })
    expect(eventos.map((e) => e.tipo)).toEqual(["SAIDA", "CHEGADA"])
  })
})

