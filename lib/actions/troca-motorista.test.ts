import { beforeEach, describe, expect, it, vi } from "vitest"
import { getServerSession } from "next-auth"

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }))
vi.mock("@/lib/auth", () => ({ authOptions: {} }))
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))
vi.mock("@/lib/prisma", () => ({ prisma: {} }))
vi.mock("@/lib/services/troca-motorista.service", () => ({ trocarMotoristaDaViagem: vi.fn() }))

import { trocarMotoristaDaViagem } from "@/lib/services/troca-motorista.service"
import { trocarMotorista } from "./troca-motorista"
import { passarViagem } from "./minhas-viagens"

const dados = { motoristaNovoId: 4, km: 152450, trocadoEm: "2026-10-02T12:00", local: "Posto Graal", motivo: "Jornada" }
const sessao = (role: string, extra: Record<string, unknown> = {}) =>
  ({ user: { id: "u1", name: "X", role, filialId: 3, ...extra } }) as never

beforeEach(() => vi.clearAllMocks())

describe("trocarMotorista (escalador)", () => {
  it("só ADMIN/DESPACHANTE; data do campo lida como horário de Brasília", async () => {
    vi.mocked(getServerSession).mockResolvedValue(sessao("DESPACHANTE"))
    await expect(trocarMotorista(5, dados)).resolves.toEqual({ sucesso: true })
    const [filial, viagem, entrada, , opcoes] = vi.mocked(trocarMotoristaDaViagem).mock.calls[0]
    expect([filial, viagem, opcoes]).toEqual([3, 5, undefined])
    expect(entrada.trocadoEm.toISOString()).toBe("2026-10-02T15:00:00.000Z") // 12:00 em Brasília

    vi.mocked(getServerSession).mockResolvedValue(sessao("MOTORISTA", { motoristaId: 7 }))
    await expect(trocarMotorista(5, dados)).resolves.toMatchObject({ sucesso: false })
    expect(trocarMotoristaDaViagem).toHaveBeenCalledTimes(1)
  })
})

describe("passarViagem (motorista pelo celular)", () => {
  it("passa sempre o motorista da sessão como 'quem está com a viagem' — não dá pra passar viagem de outro", async () => {
    vi.mocked(getServerSession).mockResolvedValue(sessao("MOTORISTA", { motoristaId: 7 }))
    await expect(passarViagem(5, dados)).resolves.toEqual({ sucesso: true })
    expect(vi.mocked(trocarMotoristaDaViagem).mock.calls[0][4]).toEqual({ exigirMotoristaAtual: 7 })
  })

  it("dado inválido (local vazio, data fora do formato do campo) nem chega no serviço", async () => {
    vi.mocked(getServerSession).mockResolvedValue(sessao("MOTORISTA", { motoristaId: 7 }))
    await expect(passarViagem(5, { ...dados, local: "  " })).resolves.toMatchObject({ sucesso: false })
    await expect(passarViagem(5, { ...dados, trocadoEm: "2026-10-02T12:00:00Z" })).resolves.toMatchObject({ sucesso: false })
    expect(trocarMotoristaDaViagem).not.toHaveBeenCalled()
  })
})
