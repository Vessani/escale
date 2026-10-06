import { beforeEach, describe, expect, it, vi } from "vitest"
import { getServerSession } from "next-auth"

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }))
vi.mock("@/lib/auth", () => ({ authOptions: {} }))
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))
vi.mock("@/lib/services/manutencao.service", () => ({
  criarManutencaoService: vi.fn(),
  editarManutencaoService: vi.fn(),
  iniciarManutencaoService: vi.fn(),
  concluirManutencaoService: vi.fn(),
  reabrirManutencaoService: vi.fn(),
  excluirManutencaoService: vi.fn(),
}))

import { revalidatePath } from "next/cache"
import * as servico from "@/lib/services/manutencao.service"
import { ManutencaoPeriodoInvalidoError } from "@/lib/errors"
import { concluirManutencao, criarManutencao, excluirManutencao, iniciarManutencao } from "./manutencoes"

const sessao = (user: Record<string, unknown>) => vi.mocked(getServerSession).mockResolvedValue({ user } as never)
const despachante = { id: "u1", name: "Ana", role: "DESPACHANTE", filialId: 3 }

const dados = {
  veiculo: "CARRETA" as const,
  codigo: "908",
  tipo: "CORRETIVA" as const,
  nivel: "B" as const,
  responsavel: "RITMO" as const,
  descricao: "",
  inicioPrevisto: "2026-10-06T08:00",
  fimPrevisto: "",
}

beforeEach(() => vi.clearAllMocks())

describe("lib/actions/manutencoes", () => {
  it("sem sessão, motorista ou superadmin (sem filial): não autorizado, nada gravado", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null)
    expect(await criarManutencao(dados)).toEqual({ sucesso: false, erro: "Não autorizado." })

    sessao({ id: "m", role: "MOTORISTA", filialId: 3, motoristaId: 9 })
    expect(await excluirManutencao(5)).toEqual({ sucesso: false, erro: "Não autorizado." })

    sessao({ id: "s", role: "SUPERADMIN", filialId: null })
    expect(await iniciarManutencao(5)).toEqual({ sucesso: false, erro: "Não autorizado." })

    expect(servico.criarManutencaoService).not.toHaveBeenCalled()
    expect(servico.excluirManutencaoService).not.toHaveBeenCalled()
    expect(servico.iniciarManutencaoService).not.toHaveBeenCalled()
  })

  it("cria na filial da sessão, com o autor, e atualiza as telas de frota", async () => {
    sessao(despachante)
    expect(await criarManutencao(dados)).toEqual({ sucesso: true })
    expect(servico.criarManutencaoService).toHaveBeenCalledWith(3, expect.objectContaining({ codigo: "908" }), { usuarioId: "u1", usuarioNome: "Ana" })
    expect(revalidatePath).toHaveBeenCalledWith("/frotas/manutencoes")
  })

  it("recusa dados inválidos e id inválido sem chamar o service", async () => {
    sessao(despachante)
    const resposta = await criarManutencao({ ...dados, codigo: "" })
    expect(resposta.sucesso).toBe(false)
    expect(servico.criarManutencaoService).not.toHaveBeenCalled()

    expect((await excluirManutencao(-1)).sucesso).toBe(false)
    expect(servico.excluirManutencaoService).not.toHaveBeenCalled()
  })

  it("concluir: horário do navegador em Brasília; sem horário usa agora; erro de regra vira mensagem", async () => {
    sessao(despachante)
    await concluirManutencao(5, "2026-10-06T17:30")
    expect(vi.mocked(servico.concluirManutencaoService).mock.calls[0][2]).toEqual(new Date("2026-10-06T17:30:00-03:00"))

    await concluirManutencao(5)
    expect(vi.mocked(servico.concluirManutencaoService).mock.calls[1][2]).toBeInstanceOf(Date)

    vi.mocked(servico.concluirManutencaoService).mockRejectedValueOnce(new ManutencaoPeriodoInvalidoError("O fim real precisa ser depois do início."))
    expect(await concluirManutencao(5, "2026-10-06T07:00")).toEqual({ sucesso: false, erro: "O fim real precisa ser depois do início." })
  })
})
