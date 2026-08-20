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
  buscarViagemPorId: vi.fn(),
}))

import { buscarViagemPorId } from "@/lib/queries/viagens"
import { GET } from "./route"

const viagemBase = {
  id: 42,
  numViagem: "904527",
  status: "CRIADA",
  turno: "MANHA",
  produto: "CO2",
  inicioPrevisto: new Date("2026-08-10T08:00:00"),
  fimPrevisto: new Date("2026-08-11T08:00:00"),
  diasViagem: 1,
  cavalo: "2026",
  carreta: "817",
  tanque: "0",
  motorista: { nome: "Luciano Machado", cpf: "11144477735" },
  motoristaAcompanhante: null,
  integracaoExigida: null,
  entregas: [],
}

function contexto(id: string) {
  return { params: Promise.resolve({ id }) }
}

const CONTENT_TYPE_EXCEL = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"

describe("GET /api/viagens/[id]/excel — isolamento por filial", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("retorna 401 sem sessão, sem consultar a viagem", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null)

    const resposta = await GET(new Request("http://x/api/viagens/42/excel"), contexto("42"))

    expect(resposta.status).toBe(401)
    expect(buscarViagemPorId).not.toHaveBeenCalled()
  })

  it("retorna 401 pra SUPERADMIN (não tem filial, não pode baixar Excel operacional)", async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: "1", role: "SUPERADMIN", filialId: null } } as never)

    const resposta = await GET(new Request("http://x/api/viagens/42/excel"), contexto("42"))

    expect(resposta.status).toBe(401)
    expect(buscarViagemPorId).not.toHaveBeenCalled()
  })

  it("retorna 400 pra id que não é um número inteiro", async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: "1", role: "DESPACHANTE", filialId: 1 } } as never)

    const resposta = await GET(new Request("http://x/api/viagens/abc/excel"), contexto("abc"))

    expect(resposta.status).toBe(400)
    expect(buscarViagemPorId).not.toHaveBeenCalled()
  })

  it("retorna 404 quando a viagem não existe NA FILIAL do usuário — impede baixar Excel de outra filial trocando o id na URL", async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: "1", role: "DESPACHANTE", filialId: 1 } } as never)
    vi.mocked(buscarViagemPorId).mockResolvedValue(null as never)

    const resposta = await GET(new Request("http://x/api/viagens/42/excel"), contexto("42"))

    expect(resposta.status).toBe(404)
    expect(buscarViagemPorId).toHaveBeenCalledWith(1, 42)
  })

  it("busca a viagem sempre com a filialId da sessão, nunca com uma vinda da URL/query", async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: "1", role: "DESPACHANTE", filialId: 9 } } as never)
    vi.mocked(buscarViagemPorId).mockResolvedValue(viagemBase as never)

    await GET(new Request("http://x/api/viagens/42/excel"), contexto("42"))

    expect(buscarViagemPorId).toHaveBeenCalledWith(9, 42)
  })

  it("gera o Excel e devolve 200 com content-type e nome de arquivo corretos quando a viagem pertence à filial", async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: "1", role: "DESPACHANTE", filialId: 1 } } as never)
    vi.mocked(buscarViagemPorId).mockResolvedValue(viagemBase as never)

    const resposta = await GET(new Request("http://x/api/viagens/42/excel"), contexto("42"))

    expect(resposta.status).toBe(200)
    expect(resposta.headers.get("Content-Type")).toBe(CONTENT_TYPE_EXCEL)
    expect(resposta.headers.get("Content-Disposition")).toContain("viagem-904527.xlsx")

    const buffer = Buffer.from(await resposta.arrayBuffer())
    expect(buffer.length).toBeGreaterThan(0)

    const workbook = XLSX.read(buffer, { type: "buffer" })
    expect(workbook.SheetNames).toEqual(["Viagem", "Entregas"])
    const linhas = XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets["Viagem"])
    expect(linhas[0]["Nº Viagem"]).toBe("904527")
  })

  it("sanitiza caracteres inválidos de nome de arquivo vindos do número da viagem", async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: "1", role: "DESPACHANTE", filialId: 1 } } as never)
    vi.mocked(buscarViagemPorId).mockResolvedValue({ ...viagemBase, numViagem: '90/45"27' } as never)

    const resposta = await GET(new Request("http://x/api/viagens/42/excel"), contexto("42"))

    expect(resposta.headers.get("Content-Disposition")).toBe('attachment; filename="viagem-90-45-27.xlsx"')
  })
})
