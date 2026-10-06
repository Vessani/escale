import { beforeEach, describe, expect, it, vi } from "vitest"
import { getServerSession } from "next-auth"

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }))
vi.mock("@/lib/auth", () => ({ authOptions: {} }))
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))
vi.mock("@/lib/services/acesso-motorista.service", () => ({ gerarPinMotorista: vi.fn(), desativarAcessoMotorista: vi.fn() }))

import { desativarAcessoMotorista, gerarPinMotorista } from "@/lib/services/acesso-motorista.service"
import { desativarAcesso, gerarAcessoMotorista } from "./acesso-motorista"

const sessao = (user: Record<string, unknown> | null) => vi.mocked(getServerSession).mockResolvedValue(user ? ({ user } as never) : null)

beforeEach(() => vi.clearAllMocks())

describe("lib/actions/acesso-motorista", () => {
  it("só o escalador (admin/despachante) com filial gera ou desativa o acesso", async () => {
    for (const user of [
      null,
      { id: "m", role: "MOTORISTA", filialId: 3, motoristaId: 7 },
      { id: "s", role: "SUPERADMIN", filialId: null },
    ]) {
      sessao(user)
      expect(await gerarAcessoMotorista(7)).toEqual({ sucesso: false, erro: "Não autorizado." })
      expect(await desativarAcesso(7)).toEqual({ sucesso: false, erro: "Não autorizado." })
    }
    expect(gerarPinMotorista).not.toHaveBeenCalled()
    expect(desativarAcessoMotorista).not.toHaveBeenCalled()
  })

  it("devolve o PIN só nessa resposta, gerado na filial da sessão", async () => {
    sessao({ id: "u1", name: "Ana", role: "DESPACHANTE", filialId: 3 })
    vi.mocked(gerarPinMotorista).mockResolvedValue({ pin: "4821", seva: 1203 })

    expect(await gerarAcessoMotorista(7)).toEqual({ sucesso: true, pin: "4821", seva: 1203 })
    expect(gerarPinMotorista).toHaveBeenCalledWith(3, 7, { usuarioId: "u1", usuarioNome: "Ana" })
  })

  it("id inválido não chega no service", async () => {
    sessao({ id: "u1", role: "ADMIN", filialId: 3 })
    expect((await desativarAcesso(0)).sucesso).toBe(false)
    expect(desativarAcessoMotorista).not.toHaveBeenCalled()
  })
})
