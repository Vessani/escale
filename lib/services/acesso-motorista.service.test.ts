import { beforeEach, describe, expect, it, vi } from "vitest"
import bcrypt from "bcrypt"

vi.mock("@/lib/prisma", () => ({
  prisma: { $transaction: vi.fn(), motorista: { findFirst: vi.fn() }, usuario: { findUnique: vi.fn() } },
}))
vi.mock("@/lib/services/auditoria.service", () => ({ registrarAuditoria: vi.fn() }))
vi.mock("@/lib/services/login.service", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/services/login.service")>()),
  limparFalhasLogin: vi.fn(),
}))

import { prisma } from "@/lib/prisma"
import { registrarAuditoria } from "@/lib/services/auditoria.service"
import { limparFalhasLogin } from "@/lib/services/login.service"
import { desativarAcessoMotorista, gerarPinMotorista, situacaoAcessoMotorista } from "./acesso-motorista.service"

const ator = { usuarioId: "a1", usuarioNome: "Alan" }
const tx = { usuario: { findUnique: vi.fn(), upsert: vi.fn(), update: vi.fn() } }

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(prisma.$transaction).mockImplementation(((callback: (t: unknown) => unknown) => Promise.resolve(callback(tx))) as never)
  vi.mocked(prisma.motorista.findFirst).mockResolvedValue({ id: 42, nome: "JOSE SILVA", seva: 261 } as never)
})

describe("gerarPinMotorista", () => {
  it("cria o acesso MOTORISTA com PIN de 6 dígitos guardado só como hash; o histórico não leva o PIN", async () => {
    tx.usuario.findUnique.mockResolvedValue(null)
    tx.usuario.upsert.mockImplementation(async ({ create }) => ({ id: "u9", ...create }))

    const { pin, seva } = await gerarPinMotorista(3, 42, ator)

    expect(pin).toMatch(/^\d{6}$/)
    expect(seva).toBe(261)
    const { create } = tx.usuario.upsert.mock.calls[0][0]
    expect(create).toMatchObject({ role: "MOTORISTA", filialId: 3, motoristaId: 42, ativo: true })
    expect(create.senha).not.toBe(pin)
    expect(await bcrypt.compare(pin, create.senha)).toBe(true)

    const auditoria = JSON.stringify(vi.mocked(registrarAuditoria).mock.calls[0][1])
    expect(auditoria).not.toContain(pin)
    expect(auditoria).not.toContain(create.senha)
    expect(vi.mocked(registrarAuditoria).mock.calls[0][1]).toMatchObject({ entidade: "Usuario", acao: "CRIACAO" })
  })

  it("PIN gerado de novo: sobe a versão (derruba a sessão do celular antigo) e libera o bloqueio de tentativas", async () => {
    tx.usuario.findUnique.mockResolvedValue({ id: "u9", nome: "JOSE SILVA", role: "MOTORISTA", ativo: true, motoristaId: 42 })
    tx.usuario.upsert.mockImplementation(async ({ update }) => ({ id: "u9", motoristaId: 42, ...update }))

    await gerarPinMotorista(3, 42, ator)

    expect(tx.usuario.upsert.mock.calls[0][0].update).toMatchObject({ versaoSessao: { increment: 1 }, ativo: true })
    expect(limparFalhasLogin).toHaveBeenCalledWith("motorista:261")
  })

  it("motorista de outra filial (ou excluído) não ganha acesso", async () => {
    vi.mocked(prisma.motorista.findFirst).mockResolvedValue(null)
    await expect(gerarPinMotorista(3, 42, ator)).rejects.toThrow("Motorista não encontrado")
    expect(prisma.motorista.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 42, filialId: 3, deletadoEm: null } }))
  })
})

describe("desativar e situação", () => {
  it("desativa só se estiver ativo", async () => {
    tx.usuario.findUnique.mockResolvedValue({ id: "u9", nome: "JOSE", role: "MOTORISTA", ativo: true, motoristaId: 42 })
    tx.usuario.update.mockResolvedValue({ id: "u9", nome: "JOSE", role: "MOTORISTA", ativo: false, motoristaId: 42 })
    await desativarAcessoMotorista(3, 42, ator)
    expect(tx.usuario.update).toHaveBeenCalledWith({ where: { motoristaId: 42 }, data: { ativo: false } })

    vi.clearAllMocks()
    tx.usuario.findUnique.mockResolvedValue(null)
    await desativarAcessoMotorista(3, 42, ator)
    expect(tx.usuario.update).not.toHaveBeenCalled()
  })

  it("situação: sem acesso, ativo, desativado", async () => {
    vi.mocked(prisma.usuario.findUnique).mockResolvedValueOnce(null).mockResolvedValueOnce({ ativo: true } as never).mockResolvedValueOnce({ ativo: false } as never)
    expect(await situacaoAcessoMotorista(42)).toBe("SEM_ACESSO")
    expect(await situacaoAcessoMotorista(42)).toBe("ATIVO")
    expect(await situacaoAcessoMotorista(42)).toBe("DESATIVADO")
  })
})
