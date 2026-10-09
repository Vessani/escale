import { beforeEach, describe, expect, it, vi } from "vitest"
import { getServerSession } from "next-auth"

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }))
vi.mock("@/lib/auth", () => ({ authOptions: {} }))
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))
vi.mock("@/lib/services/correcao-registro.service", () => ({
  corrigirKmPeloEscalador: vi.fn(async () => ({ viagemId: 5 })),
  lancarDespesaPeloEscalador: vi.fn(async () => ({ viagemId: 5 })),
  corrigirDespesaPeloEscalador: vi.fn(async () => ({ viagemId: 5 })),
  removerDespesaPeloEscalador: vi.fn(async () => ({ viagemId: 5 })),
  salvarChegadaPeloEscalador: vi.fn(async () => ({ viagemId: 5 })),
  apagarChegadaPeloEscalador: vi.fn(async () => ({ viagemId: 5 })),
}))

import { revalidatePath } from "next/cache"
import * as servico from "@/lib/services/correcao-registro.service"
import { apagarChegada, corrigirKm, lancarDespesaEscalador, salvarChegadaEscalador } from "./correcao-registro"

const sessao = (user: Record<string, unknown> | null) => vi.mocked(getServerSession).mockResolvedValue(user ? ({ user } as never) : null)
const ator = { usuarioId: "u1", usuarioNome: "Ana" }

beforeEach(() => {
  vi.clearAllMocks()
  sessao({ id: "u1", name: "Ana", role: "DESPACHANTE", filialId: 3 })
})

describe("lib/actions/correcao-registro", () => {
  it("motorista não corrige pelo caminho do escalador", async () => {
    sessao({ id: "m", role: "MOTORISTA", filialId: 3, motoristaId: 7 })
    expect(await corrigirKm(5, { kmInicial: 100, kmFinal: 200 })).toEqual({ sucesso: false, erro: "Não autorizado." })
    expect(await apagarChegada(9)).toEqual({ sucesso: false, erro: "Não autorizado." })
    expect(servico.corrigirKmPeloEscalador).not.toHaveBeenCalled()
    expect(servico.apagarChegadaPeloEscalador).not.toHaveBeenCalled()
  })

  it("corrige km na filial da sessão e atualiza edição, relatório e a área do motorista", async () => {
    expect(await corrigirKm(5, { kmInicial: 152200, kmFinal: 152900 })).toEqual({ sucesso: true })
    expect(servico.corrigirKmPeloEscalador).toHaveBeenCalledWith(
      3,
      5,
      expect.objectContaining({ kmInicial: 152200, kmFinal: 152900 }),
      ator,
    )
    expect(revalidatePath).toHaveBeenCalledWith("/viagens/editar/5")
    expect(revalidatePath).toHaveBeenCalledWith("/viagens/relatorio/5")
    expect(revalidatePath).toHaveBeenCalledWith("/minhas-viagens", "layout")
  })

  it("recusa km negativo, tipo de despesa desconhecido e valor quebrado", async () => {
    expect((await corrigirKm(5, { kmInicial: -1, kmFinal: null })).sucesso).toBe(false)
    expect((await lancarDespesaEscalador(5, { tipo: "MULTA" as never, valorCentavos: 100 })).sucesso).toBe(false)
    expect((await lancarDespesaEscalador(5, { tipo: "PEDAGIO", valorCentavos: 12.5 })).sucesso).toBe(false)
    expect(servico.corrigirKmPeloEscalador).not.toHaveBeenCalled()
    expect(servico.lancarDespesaPeloEscalador).not.toHaveBeenCalled()
  })

  it("chegada: horário digitado é lido como Brasília antes de ir pro service", async () => {
    const resposta = await salvarChegadaEscalador(21, {
      km: 152400,
      chegadaEm: "2026-10-02T09:30",
      medicao: "BALANCA",
      fatorCliente: null,
      kgInicial: 1000,
      kgFinal: 400,
      m3Inicial: null,
      m3Final: null,
      pctInicial: null,
      pctFinal: null,
      nivelInicial: null,
      nivelFinal: null,
      polInicial: null,
      polFinal: null,
    })
    expect(resposta).toEqual({ sucesso: true })
    const [, entregaId, dados] = vi.mocked(servico.salvarChegadaPeloEscalador).mock.calls[0]
    expect(entregaId).toBe(21)
    expect(dados.chegadaEm).toEqual(new Date("2026-10-02T09:30:00-03:00"))
  })
})
