import { describe, expect, it, vi, beforeEach } from "vitest"
import { getServerSession } from "next-auth"
import * as XLSX from "xlsx"

vi.mock("next-auth", () => ({
  getServerSession: vi.fn(),
}))

vi.mock("@/lib/auth", () => ({
  authOptions: {},
}))

vi.mock("@/lib/queries/motoristas", () => ({
  buscarMotoristaPorId: vi.fn(),
}))

vi.mock("@/lib/queries/viagens", () => ({
  buscarViagensPorMotorista: vi.fn(),
}))

import { buscarMotoristaPorId } from "@/lib/queries/motoristas"
import { buscarViagensPorMotorista } from "@/lib/queries/viagens"
import { GET } from "./route"

const motoristaBase = { id: 7, nome: "Luciano Machado", cpf: "11144477735" }

const viagemBase = {
  numViagem: "904527",
  status: "ALOCADA",
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

function contexto(id: string) {
  return { params: Promise.resolve({ id }) }
}

const CONTENT_TYPE_EXCEL = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"

describe("GET /api/relatorios/motorista/[id] — controle de acesso", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("retorna 401 sem sessão, sem consultar nada", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null)

    const resposta = await GET(new Request("http://x/api/relatorios/motorista/7"), contexto("7"))

    expect(resposta.status).toBe(401)
    expect(buscarMotoristaPorId).not.toHaveBeenCalled()
  })

  it("retorna 401 pra SUPERADMIN (não tem filial)", async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: "1", role: "SUPERADMIN", filialId: null } } as never)

    const resposta = await GET(new Request("http://x/api/relatorios/motorista/7"), contexto("7"))

    expect(resposta.status).toBe(401)
    expect(buscarMotoristaPorId).not.toHaveBeenCalled()
  })

  it("retorna 400 pra id que não é um número inteiro", async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: "1", role: "DESPACHANTE", filialId: 1 } } as never)

    const resposta = await GET(new Request("http://x/api/relatorios/motorista/abc"), contexto("abc"))

    expect(resposta.status).toBe(400)
    expect(buscarMotoristaPorId).not.toHaveBeenCalled()
  })

  it("retorna 404 quando o motorista não existe NA FILIAL do usuário", async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: "1", role: "DESPACHANTE", filialId: 1 } } as never)
    vi.mocked(buscarMotoristaPorId).mockResolvedValue(null as never)

    const resposta = await GET(new Request("http://x/api/relatorios/motorista/7"), contexto("7"))

    expect(resposta.status).toBe(404)
    expect(buscarMotoristaPorId).toHaveBeenCalledWith(1, 7)
    expect(buscarViagensPorMotorista).not.toHaveBeenCalled()
  })

  it("busca sempre com a filialId da sessão, nunca uma vinda da URL/query", async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: "1", role: "DESPACHANTE", filialId: 9 } } as never)
    vi.mocked(buscarMotoristaPorId).mockResolvedValue(motoristaBase as never)
    vi.mocked(buscarViagensPorMotorista).mockResolvedValue([])

    await GET(new Request("http://x/api/relatorios/motorista/7"), contexto("7"))

    expect(buscarMotoristaPorId).toHaveBeenCalledWith(9, 7)
    expect(buscarViagensPorMotorista).toHaveBeenCalledWith(9, 7)
  })

  it("gera o Excel do motorista e devolve 200 com nome de arquivo baseado no nome dele", async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: "1", role: "DESPACHANTE", filialId: 1 } } as never)
    vi.mocked(buscarMotoristaPorId).mockResolvedValue(motoristaBase as never)
    vi.mocked(buscarViagensPorMotorista).mockResolvedValue([viagemBase] as never)

    const resposta = await GET(new Request("http://x/api/relatorios/motorista/7"), contexto("7"))

    expect(resposta.status).toBe(200)
    expect(resposta.headers.get("Content-Type")).toBe(CONTENT_TYPE_EXCEL)
    expect(resposta.headers.get("Content-Disposition")).toContain("viagens-Luciano Machado.xlsx")

    const buffer = Buffer.from(await resposta.arrayBuffer())
    const workbook = XLSX.read(buffer, { type: "buffer" })
    const linhas = XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets["Viagens"])
    expect(linhas).toHaveLength(1)
    expect(linhas[0]["Status"]).toBe("ALOCADA")
  })
})
