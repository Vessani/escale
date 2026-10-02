import { beforeEach, describe, expect, it, vi } from "vitest"
import { getServerSession } from "next-auth"
import { nomesDasAbas, textoDaAba } from "@/lib/excel/ler-planilha"

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }))
vi.mock("@/lib/auth", () => ({ authOptions: {} }))
vi.mock("@/lib/queries/filiais", () => ({ buscarNomeFilial: vi.fn().mockResolvedValue("Joinville") }))
vi.mock("@/lib/relatorios/relatorio-viagem", () => ({ carregarRelatorioViagem: vi.fn() }))

import { carregarRelatorioViagem } from "@/lib/relatorios/relatorio-viagem"
import { GET } from "./route"

const h = (hora: string) => new Date(`2026-10-02T${hora}:00-03:00`)

const relatorio = {
  id: 5,
  numViagem: "922087",
  status: "FINALIZADA",
  problemaMecanico: null,
  problemaMecanicoEm: null,
  motorista: "Luciano Machado",
  teveTroca: false,
  acompanhante: null,
  cavalo: "2025",
  carreta: "795",
  produto: "Oxigênio",
  inicioPrevisto: h("07:00"),
  fimPrevisto: h("18:00"),
  saidaReal: h("07:20"),
  atrasoMinutos: 20,
  motivoAtraso: "Troca de frota",
  encerramento: { rotulo: "Encerrada em", quando: h("17:30") },
  kmInicial: 152300,
  kmFinal: 152780,
  kmRodado: 480,
  entregas: [
    {
      id: 1,
      ordem: 1,
      cliente: "HOSPITAL SANTA ISABEL",
      cidade: "Joinville/SC",
      prevista: h("10:00"),
      chegada: { quando: h("10:05"), km: 152410, medicao: "Balança × 0,754", leituras: "1.000 → 400", total: 452.4, unidade: "m³" },
    },
  ],
  totaisDescarga: [{ unidade: "m³", total: 452.4 }],
  despesas: [{ id: 1, tipo: "Pedágio", quando: h("09:00"), centavos: 1250 }],
  pedagioCentavos: 1250,
  pernoiteCentavos: 0,
  trocas: [],
  linhaDoTempo: [{ quando: h("07:20"), tipo: "SAIDA", titulo: "Saída", detalhe: "km 152.300" }],
}

const contexto = (id: string) => ({ params: Promise.resolve({ id }) })
const sessao = (role: string, filialId: number | null = 3) => ({ user: { id: "u1", role, filialId } }) as never

describe("GET /api/viagens/[id]/relatorio", () => {
  beforeEach(() => vi.clearAllMocks())

  it("401 sem sessão e pro motorista — sem consultar a viagem", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null)
    expect((await GET(new Request("http://x"), contexto("5"))).status).toBe(401)
    vi.mocked(getServerSession).mockResolvedValue(sessao("MOTORISTA"))
    expect((await GET(new Request("http://x"), contexto("5"))).status).toBe(401)
    expect(carregarRelatorioViagem).not.toHaveBeenCalled()
  })

  it("400 com id inválido; 404 quando a viagem não é da filial", async () => {
    vi.mocked(getServerSession).mockResolvedValue(sessao("DESPACHANTE"))
    expect((await GET(new Request("http://x"), contexto("abc"))).status).toBe(400)
    vi.mocked(carregarRelatorioViagem).mockResolvedValue(null)
    expect((await GET(new Request("http://x"), contexto("5"))).status).toBe(404)
    expect(carregarRelatorioViagem).toHaveBeenCalledWith(3, 5)
  })

  it("Excel numa aba só, com as seções e os dados da viagem", async () => {
    vi.mocked(getServerSession).mockResolvedValue(sessao("DESPACHANTE"))
    vi.mocked(carregarRelatorioViagem).mockResolvedValue(relatorio as never)

    const resposta = await GET(new Request("http://x"), contexto("5"))
    expect(resposta.status).toBe(200)
    expect(resposta.headers.get("content-disposition")).toContain("relatorio-viagem-922087")

    const buffer = Buffer.from(await resposta.arrayBuffer())
    expect(nomesDasAbas(buffer)).toEqual(["Viagem 922087"])
    const texto = textoDaAba(buffer, "Viagem 922087")
    for (const trecho of ["Resumo", "Entregas e chegadas", "Despesas", "Trocas de motorista", "Linha do tempo", "HOSPITAL SANTA ISABEL", "Balança × 0,754", "Pedágio"]) {
      expect(texto).toContain(trecho)
    }
  })
})
