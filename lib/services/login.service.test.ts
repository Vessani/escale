import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: vi.fn(),
    tentativaLogin: { count: vi.fn(), create: vi.fn(), deleteMany: vi.fn() },
  },
}))

import { prisma } from "@/lib/prisma"
import {
  garantirLoginNaoBloqueado,
  ipDaRequisicao,
  JANELA_BLOQUEIO_MINUTOS,
  LoginBloqueadoError,
  MAX_FALHAS_POR_EMAIL,
  MAX_FALHAS_POR_IP,
  MAX_FALHAS_MOTORISTA_24H,
  chaveLoginMotorista,
  garantirPinNaoBloqueado,
  normalizarEmail,
  PinBloqueadoError,
} from "./login.service"

describe("login.service", () => {
  beforeEach(() => vi.clearAllMocks())
  const agora = new Date("2026-09-30T12:00:00Z")

  it("normaliza e-mail e lê o IP do primeiro x-forwarded-for", () => {
    expect(normalizarEmail("  Ana@Ritmo.COM ")).toBe("ana@ritmo.com")
    expect(ipDaRequisicao({ "x-forwarded-for": "200.1.1.1, 10.0.0.1" })).toBe("200.1.1.1")
    expect(ipDaRequisicao({ "x-real-ip": "9.9.9.9" })).toBe("9.9.9.9")
    expect(ipDaRequisicao(undefined)).toBeNull()
  })

  it("libera abaixo do limite e conta só a janela", async () => {
    vi.mocked(prisma.tentativaLogin.count).mockResolvedValue(MAX_FALHAS_POR_EMAIL - 1)

    await expect(garantirLoginNaoBloqueado("ana@ritmo.com", "1.1.1.1", agora)).resolves.toBeUndefined()

    const desde = new Date(agora.getTime() - JANELA_BLOQUEIO_MINUTOS * 60_000)
    expect(prisma.tentativaLogin.count).toHaveBeenCalledWith({
      where: { email: "ana@ritmo.com", criadoEm: { gte: desde } },
    })
  })

  it("bloqueia pelo e-mail", async () => {
    vi.mocked(prisma.tentativaLogin.count).mockResolvedValueOnce(MAX_FALHAS_POR_EMAIL).mockResolvedValueOnce(0)
    await expect(garantirLoginNaoBloqueado("ana@ritmo.com", "1.1.1.1", agora)).rejects.toBeInstanceOf(
      LoginBloqueadoError,
    )
  })

  it("bloqueia pelo IP mesmo trocando de e-mail", async () => {
    vi.mocked(prisma.tentativaLogin.count).mockResolvedValueOnce(0).mockResolvedValueOnce(MAX_FALHAS_POR_IP)
    await expect(garantirLoginNaoBloqueado("outro@ritmo.com", "1.1.1.1", agora)).rejects.toBeInstanceOf(
      LoginBloqueadoError,
    )
  })

  it("PIN do motorista: trava em 10 erros nas últimas 24h, contando pela matrícula", async () => {
    vi.mocked(prisma.tentativaLogin.count).mockResolvedValueOnce(MAX_FALHAS_MOTORISTA_24H - 1)
    await expect(garantirPinNaoBloqueado(chaveLoginMotorista(261), agora)).resolves.toBeUndefined()
    expect(prisma.tentativaLogin.count).toHaveBeenCalledWith({
      where: { email: "motorista:261", criadoEm: { gte: new Date(agora.getTime() - 24 * 60 * 60 * 1000) } },
    })

    vi.mocked(prisma.tentativaLogin.count).mockResolvedValueOnce(MAX_FALHAS_MOTORISTA_24H)
    await expect(garantirPinNaoBloqueado(chaveLoginMotorista(261), agora)).rejects.toBeInstanceOf(PinBloqueadoError)
  })
})
