import { describe, expect, it, vi, beforeEach } from "vitest"
import { getServerSession } from "next-auth"
import * as XLSX from "xlsx"

vi.mock("next-auth", () => ({
  getServerSession: vi.fn(),
}))

vi.mock("@/lib/auth", () => ({
  authOptions: {},
}))

vi.mock("@/lib/queries/viagens", () => ({
  buscarViagensCriadasEm: vi.fn(),
}))

import { buscarViagensCriadasEm } from "@/lib/queries/viagens"
import { GET } from "./route"

const viagemBase = {
  numViagem: "904527",
  status: "CRIADA",
  turno: "MANHA",
  produto: "CO2",
  inicioPrevisto: new Date("2026-08-10T08:00:00"),
  fimPrevisto: new Date("2026-08-11T08:00:00"),
  cavalo: "2026",
  carreta: "817",
  tanque: "0",
  motorista: null,
  motoristaAcompanhante: null,
  integracaoExigida: null,
}

const CONTENT_TYPE_EXCEL = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"

describe("GET /api/relatorios/diario — controle de acesso e data", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("retorna 401 sem sessão, sem consultar viagens", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null)

    const resposta = await GET(new Request("http://x/api/relatorios/diario"))

    expect(resposta.status).toBe(401)
    expect(buscarViagensCriadasEm).not.toHaveBeenCalled()
  })

  it("retorna 401 pra SUPERADMIN (não tem filial)", async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: "1", role: "SUPERADMIN", filialId: null } } as never)

    const resposta = await GET(new Request("http://x/api/relatorios/diario"))

    expect(resposta.status).toBe(401)
    expect(buscarViagensCriadasEm).not.toHaveBeenCalled()
  })

  it("retorna 400 para data inválida", async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: "1", role: "DESPACHANTE", filialId: 1 } } as never)

    const resposta = await GET(new Request("http://x/api/relatorios/diario?data=nao-e-data"))

    expect(resposta.status).toBe(400)
    expect(buscarViagensCriadasEm).not.toHaveBeenCalled()
  })

  it("usa a data de hoje quando nenhuma é informada", async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: "1", role: "DESPACHANTE", filialId: 1 } } as never)
    vi.mocked(buscarViagensCriadasEm).mockResolvedValue([])

    await GET(new Request("http://x/api/relatorios/diario"))

    const dataUsada = vi.mocked(buscarViagensCriadasEm).mock.calls[0][1]
    const hoje = new Date()
    expect(dataUsada.toDateString()).toBe(hoje.toDateString())
  })

  it("busca sempre com a filialId da sessão e repassa a data informada", async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: "1", role: "DESPACHANTE", filialId: 9 } } as never)
    vi.mocked(buscarViagensCriadasEm).mockResolvedValue([])

    await GET(new Request("http://x/api/relatorios/diario?data=2026-08-15"))

    expect(buscarViagensCriadasEm).toHaveBeenCalledWith(9, new Date(2026, 7, 15))
  })

  it("gera o Excel do dia e devolve 200 com o conteúdo esperado", async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: "1", role: "DESPACHANTE", filialId: 1 } } as never)
    vi.mocked(buscarViagensCriadasEm).mockResolvedValue([viagemBase] as never)

    const resposta = await GET(new Request("http://x/api/relatorios/diario?data=2026-08-15"))

    expect(resposta.status).toBe(200)
    expect(resposta.headers.get("Content-Type")).toBe(CONTENT_TYPE_EXCEL)
    expect(resposta.headers.get("Content-Disposition")).toContain("viagens-criadas.xlsx")

    const buffer = Buffer.from(await resposta.arrayBuffer())
    const workbook = XLSX.read(buffer, { type: "buffer" })
    const linhas = XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets["Viagens"])
    expect(linhas).toHaveLength(1)
    expect(linhas[0]["Motorista"]).toBe("Não alocado")
  })
})
