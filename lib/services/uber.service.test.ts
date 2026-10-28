import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: vi.fn(),
    motorista: { findFirst: vi.fn() },
    viagem: { findFirst: vi.fn() },
    solicitacaoUber: { findFirst: vi.fn(), findUnique: vi.fn() },
  },
}))
vi.mock("@/lib/services/auditoria.service", () => ({ registrarAuditoria: vi.fn() }))

import { prisma } from "@/lib/prisma"
import { registrarAuditoria } from "@/lib/services/auditoria.service"
import { cancelarSolicitacaoUber, criarSolicitacaoUber, decidirUberPorToken, gerarNovoLinkUber } from "./uber.service"
import { hashDoToken } from "./link-aprovacao"

const FILIAL = 3
const ator = { usuarioId: "u1", usuarioNome: "Alan" }
const agora = new Date("2026-10-27T12:00:00Z")

const tx = {
  solicitacaoUber: {
    create: vi.fn(),
    updateMany: vi.fn(),
    findFirst: vi.fn(),
    findUniqueOrThrow: vi.fn().mockResolvedValue({ id: 5, tokenHash: "x" }),
  },
}

const dados = (parcial: Record<string, unknown> = {}) => ({
  motoristaId: 7,
  viagemId: null as number | null,
  origem: "Posto Graal, BR-101 km 120",
  destino: "Hotel Ibis, Joinville",
  motivo: "PERNOITE" as const,
  ...parcial,
})

beforeEach(() => {
  vi.clearAllMocks()
  process.env.NEXTAUTH_URL = "https://escalador.test/"
  vi.mocked(prisma.$transaction).mockImplementation(((cb: (t: unknown) => unknown) => Promise.resolve(cb(tx))) as never)
  vi.mocked(prisma.motorista.findFirst).mockResolvedValue({ id: 7, nome: "JOÃO DA SILVA" } as never)
  vi.mocked(prisma.solicitacaoUber.findFirst).mockResolvedValue(null)
  tx.solicitacaoUber.create.mockImplementation(({ data }: { data: Record<string, unknown> }) => Promise.resolve({ id: 5, ...data }))
  tx.solicitacaoUber.updateMany.mockResolvedValue({ count: 1 })
})

describe("criarSolicitacaoUber", () => {
  it("grava origem, destino e motivo com o hash do token e validade de 12h, e devolve o link do WhatsApp", async () => {
    const link = await criarSolicitacaoUber(FILIAL, dados(), ator, { agora })

    const { data } = tx.solicitacaoUber.create.mock.calls[0][0]
    expect(data).toMatchObject({
      filialId: FILIAL,
      motoristaId: 7,
      origem: "Posto Graal, BR-101 km 120",
      destino: "Hotel Ibis, Joinville",
      motivo: "PERNOITE",
      solicitadoPorNome: "Alan",
      pedidoPeloMotorista: false,
      expiraEm: new Date("2026-10-28T00:00:00Z"),
    })
    expect(link.url.startsWith("https://escalador.test/aprovar-uber/")).toBe(true)
    expect(data.tokenHash).toBe(hashDoToken(link.url.split("/").at(-1)!))

    const mensagem = decodeURIComponent(link.linkWhatsApp.split("?text=")[1])
    expect(mensagem).toContain("*Solicitação de Uber*")
    expect(mensagem).toContain("Origem: Posto Graal, BR-101 km 120")
    expect(mensagem).toContain("Destino: Hotel Ibis, Joinville")
    expect(mensagem).toContain("Motivo: Pernoite")
    expect(mensagem).toContain(link.url)

    // A auditoria nunca recebe o hash do token.
    expect(vi.mocked(registrarAuditoria).mock.calls[0][1].depois).not.toHaveProperty("tokenHash")
  })

  it("marca quando foi o próprio motorista que pediu", async () => {
    await criarSolicitacaoUber(FILIAL, dados(), ator, { pedidoPeloMotorista: true, agora })
    expect(tx.solicitacaoUber.create.mock.calls[0][0].data.pedidoPeloMotorista).toBe(true)
  })

  it("recusa viagem que não é do motorista e motorista de outra filial", async () => {
    vi.mocked(prisma.viagem.findFirst).mockResolvedValue(null)
    await expect(criarSolicitacaoUber(FILIAL, dados({ viagemId: 99 }), ator, { agora })).rejects.toThrow("não é desse motorista")

    vi.mocked(prisma.motorista.findFirst).mockResolvedValue(null)
    await expect(criarSolicitacaoUber(FILIAL, dados(), ator, { agora })).rejects.toThrow("Motorista não encontrado")
    expect(tx.solicitacaoUber.create).not.toHaveBeenCalled()
  })

  it("não deixa abrir um segundo pedido enquanto o primeiro está com o gestor", async () => {
    vi.mocked(prisma.solicitacaoUber.findFirst).mockResolvedValue({ id: 1 } as never)
    await expect(criarSolicitacaoUber(FILIAL, dados(), ator, { agora })).rejects.toThrow("aguardando o gestor")
    expect(prisma.solicitacaoUber.findFirst).toHaveBeenCalledWith({
      where: { filialId: FILIAL, motoristaId: 7, status: "PENDENTE", expiraEm: { gt: agora } },
      select: { id: true },
    })
  })
})

describe("decidirUberPorToken", () => {
  const token = "a".repeat(43)
  const pendente = {
    id: 5,
    filialId: FILIAL,
    status: "PENDENTE",
    expiraEm: new Date("2026-10-27T20:00:00Z"),
    tokenHash: hashDoToken(token),
  }

  it("aprova só se pendente e dentro da validade, gravando nome, hora, IP e observação", async () => {
    vi.mocked(prisma.solicitacaoUber.findUnique).mockResolvedValue(pendente as never)

    await expect(
      decidirUberPorToken(token, "APROVADO", { nome: " Roberto ", observacao: " pode chamar ", ip: "200.1.1.1" }, agora),
    ).resolves.toEqual({
      decisao: "APROVADO",
    })
    expect(tx.solicitacaoUber.updateMany).toHaveBeenCalledWith({
      where: { id: 5, tokenHash: hashDoToken(token), status: "PENDENTE", expiraEm: { gt: agora } },
      data: { status: "APROVADO", decididoEm: agora, decididoPorNome: "Roberto", observacaoGestor: "pode chamar", decisaoIp: "200.1.1.1" },
    })
    expect(vi.mocked(registrarAuditoria).mock.calls[0][1].ator).toEqual({ usuarioId: "link-uber", usuarioNome: "Roberto (via link)" })
  })

  it("link expirado, já decidido ou desconhecido não decide", async () => {
    vi.mocked(prisma.solicitacaoUber.findUnique).mockResolvedValue({ ...pendente, expiraEm: new Date("2026-10-27T11:00:00Z") } as never)
    await expect(decidirUberPorToken(token, "APROVADO", { nome: "R", ip: null }, agora)).rejects.toThrow("expirou")

    vi.mocked(prisma.solicitacaoUber.findUnique).mockResolvedValue({ ...pendente, status: "CANCELADO" } as never)
    await expect(decidirUberPorToken(token, "APROVADO", { nome: "R", ip: null }, agora)).rejects.toThrow("já foi respondido")

    vi.mocked(prisma.solicitacaoUber.findUnique).mockResolvedValue(null)
    await expect(decidirUberPorToken(token, "APROVADO", { nome: "R", ip: null }, agora)).rejects.toThrow("Link inválido")
    expect(tx.solicitacaoUber.updateMany).not.toHaveBeenCalled()
  })

  it("dois cliques ao mesmo tempo: o que chega depois não grava", async () => {
    vi.mocked(prisma.solicitacaoUber.findUnique).mockResolvedValue(pendente as never)
    tx.solicitacaoUber.updateMany.mockResolvedValue({ count: 0 })
    await expect(decidirUberPorToken(token, "RECUSADO", { nome: "R", ip: null }, agora)).rejects.toThrow("já foi respondido")
    expect(registrarAuditoria).not.toHaveBeenCalled()
  })
})

describe("gerarNovoLinkUber / cancelarSolicitacaoUber", () => {
  const pendente = {
    id: 5,
    status: "PENDENTE",
    origem: "A",
    destino: "B",
    motivo: "MANUTENCAO",
    tokenHash: "antigo",
    motorista: { nome: "JOÃO" },
    viagem: null,
  }

  it("troca o token e renova a validade, e na área do motorista só acha os pedidos dele", async () => {
    vi.mocked(prisma.solicitacaoUber.findFirst).mockResolvedValue(pendente as never)

    const link = await gerarNovoLinkUber(FILIAL, 5, ator, { doMotorista: 7, agora })

    expect(vi.mocked(prisma.solicitacaoUber.findFirst).mock.calls[0][0]?.where).toEqual({ id: 5, filialId: FILIAL, motoristaId: 7 })
    const { where, data } = tx.solicitacaoUber.updateMany.mock.calls[0][0]
    expect(where).toEqual({ id: 5, filialId: FILIAL, motoristaId: 7, status: "PENDENTE" })
    expect(data.tokenHash).toBe(hashDoToken(link.url.split("/").at(-1)!))
    expect(data.expiraEm).toEqual(new Date("2026-10-28T00:00:00Z"))
    expect(decodeURIComponent(link.linkWhatsApp)).toContain("Motivo: Manutenção")
  })

  it("não gera link novo pra pedido já decidido", async () => {
    vi.mocked(prisma.solicitacaoUber.findFirst).mockResolvedValue({ ...pendente, status: "APROVADO" } as never)
    await expect(gerarNovoLinkUber(FILIAL, 5, ator, { agora })).rejects.toThrow("já foi encerrado")
  })

  it("cancelar só funciona enquanto pendente", async () => {
    tx.solicitacaoUber.findFirst.mockResolvedValue({ id: 5, status: "APROVADO" })
    tx.solicitacaoUber.updateMany.mockResolvedValue({ count: 0 })
    await expect(cancelarSolicitacaoUber(FILIAL, 5, ator)).rejects.toThrow("já foi respondido")
  })
})
