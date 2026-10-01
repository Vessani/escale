import { describe, expect, it, vi, beforeEach } from "vitest"
import { getServerSession } from "next-auth"

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }))
vi.mock("@/lib/queries/filiais", () => ({ buscarNomeFilial: vi.fn().mockResolvedValue("Joinville") }))

vi.mock("@/lib/auth", () => ({ authOptions: {} }))
vi.mock("@/lib/queries/relatorios/operacao", () => ({
  buscarIntegracoesParaRelatorio: vi.fn().mockResolvedValue([]),
  buscarViagensPontualidade: vi.fn(),
  buscarViagensComAviso: vi.fn(),
  buscarDadosUsoFrota: vi.fn(),
}))
vi.mock("@/lib/queries/relatorios/jornada", () => ({ carregarDadosJornada: vi.fn() }))
vi.mock("@/lib/queries/circadiano", () => ({ buscarRelatorioCircadiano: vi.fn() }))
vi.mock("@/lib/queries/estouro-setimo-dia", () => ({ buscarEstourosSetimoDia: vi.fn() }))

import { buscarIntegracoesParaRelatorio } from "@/lib/queries/relatorios/operacao"
import { GET } from "./route"

const chamar = (tipo: string, query = "") =>
  GET(new Request(`http://localhost/api/relatorios/exportar/${tipo}${query}`), { params: Promise.resolve({ tipo }) })

describe("GET /api/relatorios/exportar/[tipo]", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: "1", role: "ADMIN", filialId: 3 } } as never)
  })

  it("401 sem sessão", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null)
    expect((await chamar("integracoes")).status).toBe(401)
    expect(buscarIntegracoesParaRelatorio).not.toHaveBeenCalled()
  })

  it("404 pra relatório que não existe (nem herdado do Object)", async () => {
    expect((await chamar("xyz")).status).toBe(404)
    expect((await chamar("toString")).status).toBe(404)
  })

  it("400 pra período inválido", async () => {
    expect((await chamar("pontualidade", "?de=2026-02-30")).status).toBe(400)
  })

  it("gera o xlsx com a filial da sessão e os filtros da URL", async () => {
    const resposta = await chamar("integracoes", "?dias=60")

    expect(resposta.status).toBe(200)
    expect(resposta.headers.get("Content-Type")).toContain("spreadsheetml")
    expect(resposta.headers.get("Content-Disposition")).toContain("integracoes-proximos-60-dias.xlsx")
    expect(buscarIntegracoesParaRelatorio).toHaveBeenCalledWith(3, 60)
  })
})
