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
  buscarViagensParaRelatorioGeral: vi.fn(),
}))

import { buscarViagensParaRelatorioGeral } from "@/lib/queries/viagens"
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
  motorista: { nome: "Luciano Machado", cpf: "11144477735" },
  motoristaAcompanhante: null,
  integracaoExigida: null,
}

const CONTENT_TYPE_EXCEL = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"

describe("GET /api/relatorios/geral — controle de acesso e filtros", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("retorna 401 sem sessão, sem consultar viagens", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null)

    const resposta = await GET(new Request("http://x/api/relatorios/geral"))

    expect(resposta.status).toBe(401)
    expect(buscarViagensParaRelatorioGeral).not.toHaveBeenCalled()
  })

  it("retorna 401 pra SUPERADMIN (não tem filial)", async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: "1", role: "SUPERADMIN", filialId: null } } as never)

    const resposta = await GET(new Request("http://x/api/relatorios/geral"))

    expect(resposta.status).toBe(401)
    expect(buscarViagensParaRelatorioGeral).not.toHaveBeenCalled()
  })

  it("retorna 400 para período inválido", async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: "1", role: "DESPACHANTE", filialId: 1 } } as never)

    const resposta = await GET(new Request("http://x/api/relatorios/geral?de=data-invalida"))

    expect(resposta.status).toBe(400)
    expect(buscarViagensParaRelatorioGeral).not.toHaveBeenCalled()
  })

  it("busca sempre com a filialId da sessão, e repassa status/de/ate da query", async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: "1", role: "DESPACHANTE", filialId: 9 } } as never)
    vi.mocked(buscarViagensParaRelatorioGeral).mockResolvedValue([])

    await GET(new Request("http://x/api/relatorios/geral?status=ALOCADA&de=2026-08-01&ate=2026-08-31"))

    expect(buscarViagensParaRelatorioGeral).toHaveBeenCalledWith(9, {
      status: "ALOCADA",
      de: new Date(2026, 7, 1),
      ate: new Date(2026, 7, 31),
    })
  })

  it("gera o Excel geral e devolve 200 com o conteúdo esperado", async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: "1", role: "DESPACHANTE", filialId: 1 } } as never)
    vi.mocked(buscarViagensParaRelatorioGeral).mockResolvedValue([viagemBase] as never)

    const resposta = await GET(new Request("http://x/api/relatorios/geral"))

    expect(resposta.status).toBe(200)
    expect(resposta.headers.get("Content-Type")).toBe(CONTENT_TYPE_EXCEL)
    expect(resposta.headers.get("Content-Disposition")).toContain("relatorio-geral-viagens.xlsx")

    const buffer = Buffer.from(await resposta.arrayBuffer())
    const workbook = XLSX.read(buffer, { type: "buffer" })
    expect(workbook.SheetNames).toEqual(["Viagens"])
    const linhas = XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets["Viagens"])
    expect(linhas).toHaveLength(1)
    expect(linhas[0]["Nº Viagem"]).toBe("904527")
    expect(linhas[0]["CPF Motorista"]).toBe("11144477735")
  })
})
