import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: vi.fn(),
    motorista: { findFirst: vi.fn() },
    viagem: { findFirst: vi.fn() },
    estouroJornada: { findFirst: vi.fn(), findUnique: vi.fn() },
  },
}))
vi.mock("@/lib/services/auditoria.service", () => ({ registrarAuditoria: vi.fn() }))

import { prisma } from "@/lib/prisma"
import { registrarAuditoria } from "@/lib/services/auditoria.service"
import {
  cancelarSolicitacaoEstouro,
  criarSolicitacaoEstouro,
  decidirEstouroPorToken,
  gerarNovoLinkEstouro,
  gerarTokenEstouro,
  hashDoToken,
  urlDeAprovacao,
} from "./estouro-jornada.service"

const FILIAL = 3
const ator = { usuarioId: "u1", usuarioNome: "Alan" }
const agora = new Date("2026-10-27T12:00:00Z")

const tx = {
  estouroJornada: {
    create: vi.fn(),
    updateMany: vi.fn(),
    findFirst: vi.fn(),
    findUniqueOrThrow: vi.fn().mockResolvedValue({ id: 5, tokenHash: "x" }),
  },
}

const dados = (parcial: Record<string, unknown> = {}) => ({
  motoristaId: 7,
  viagemId: null as number | null,
  minutosExtras: 90,
  motivos: ["CLIENTE_PRIORITARIO", "TRANSITO_LENTO"] as ("CLIENTE_PRIORITARIO" | "TRANSITO_LENTO")[],
  ...parcial,
})

beforeEach(() => {
  vi.clearAllMocks()
  process.env.NEXTAUTH_URL = "https://escalador.test/"
  vi.mocked(prisma.$transaction).mockImplementation(((cb: (t: unknown) => unknown) => Promise.resolve(cb(tx))) as never)
  vi.mocked(prisma.motorista.findFirst).mockResolvedValue({ id: 7, nome: "JOÃO DA SILVA" } as never)
  vi.mocked(prisma.estouroJornada.findFirst).mockResolvedValue(null)
  tx.estouroJornada.create.mockImplementation(({ data }: { data: Record<string, unknown> }) => Promise.resolve({ id: 5, ...data }))
  tx.estouroJornada.updateMany.mockResolvedValue({ count: 1 })
})

describe("token do link", () => {
  it("é aleatório, de 43 caracteres base64url, e só o hash SHA-256 vai pro banco", () => {
    const a = gerarTokenEstouro()
    const b = gerarTokenEstouro()
    expect(a.token).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expect(a.token).not.toBe(b.token)
    expect(a.tokenHash).toBe(hashDoToken(a.token))
    expect(a.tokenHash).toMatch(/^[0-9a-f]{64}$/)
    expect(a.tokenHash).not.toContain(a.token)
  })

  it("monta a URL pública a partir do NEXTAUTH_URL, sem barra dupla", () => {
    expect(urlDeAprovacao("abc", "https://escalador.test/")).toBe("https://escalador.test/aprovar-estouro/abc")
  })
})

describe("criarSolicitacaoEstouro", () => {
  it("grava o pedido com o hash do token e validade de 12h, e devolve o link de compartilhar no WhatsApp", async () => {
    const link = await criarSolicitacaoEstouro(FILIAL, dados(), ator, { agora })

    const { data } = tx.estouroJornada.create.mock.calls[0][0]
    expect(data).toMatchObject({
      filialId: FILIAL,
      motoristaId: 7,
      minutosExtras: 90,
      motivos: ["CLIENTE_PRIORITARIO", "TRANSITO_LENTO"],
      solicitadoPorId: "u1",
      solicitadoPorNome: "Alan",
      pedidoPeloMotorista: false,
      expiraEm: new Date("2026-10-28T00:00:00Z"),
    })
    const token = link.url.split("/").at(-1)!
    expect(data.tokenHash).toBe(hashDoToken(token))
    expect(link.linkWhatsApp.startsWith("https://wa.me/?text=")).toBe(true)
    expect(decodeURIComponent(link.linkWhatsApp)).toContain(link.url)

    // A auditoria nunca recebe o hash do token.
    const auditoria = vi.mocked(registrarAuditoria).mock.calls[0][1]
    expect(auditoria.depois).not.toHaveProperty("tokenHash")
  })

  it("marca quando foi o próprio motorista que pediu", async () => {
    await criarSolicitacaoEstouro(FILIAL, dados(), ator, { pedidoPeloMotorista: true, agora })
    expect(tx.estouroJornada.create.mock.calls[0][0].data.pedidoPeloMotorista).toBe(true)
  })

  it("recusa viagem que não é do motorista", async () => {
    vi.mocked(prisma.viagem.findFirst).mockResolvedValue(null)
    await expect(criarSolicitacaoEstouro(FILIAL, dados({ viagemId: 99 }), ator, { agora })).rejects.toThrow("não é desse motorista")
    expect(tx.estouroJornada.create).not.toHaveBeenCalled()
  })

  it("não deixa abrir um segundo pedido enquanto o primeiro está com o gestor", async () => {
    vi.mocked(prisma.estouroJornada.findFirst).mockResolvedValue({ id: 1 } as never)
    await expect(criarSolicitacaoEstouro(FILIAL, dados(), ator, { agora })).rejects.toThrow("aguardando o gestor")
    expect(prisma.estouroJornada.findFirst).toHaveBeenCalledWith({
      where: { filialId: FILIAL, motoristaId: 7, status: "PENDENTE", expiraEm: { gt: agora } },
      select: { id: true },
    })
  })

  it("recusa motorista de outra filial", async () => {
    vi.mocked(prisma.motorista.findFirst).mockResolvedValue(null)
    await expect(criarSolicitacaoEstouro(FILIAL, dados(), ator, { agora })).rejects.toThrow("Motorista não encontrado")
  })
})

describe("decidirEstouroPorToken", () => {
  const token = "a".repeat(43)
  const pendente = {
    id: 5,
    filialId: FILIAL,
    status: "PENDENTE",
    expiraEm: new Date("2026-10-27T20:00:00Z"),
    tokenHash: hashDoToken(token),
  }

  it("aprova só se ainda estiver pendente e dentro da validade, gravando nome digitado, hora, IP e observação", async () => {
    vi.mocked(prisma.estouroJornada.findUnique).mockResolvedValue(pendente as never)

    await expect(
      decidirEstouroPorToken(token, "APROVADO", { nome: "  Roberto ", observacao: "  ok, autorizado  ", ip: "200.1.1.1" }, agora),
    ).resolves.toEqual({ decisao: "APROVADO" })

    expect(tx.estouroJornada.updateMany).toHaveBeenCalledWith({
      where: { id: 5, tokenHash: hashDoToken(token), status: "PENDENTE", expiraEm: { gt: agora } },
      data: {
        status: "APROVADO",
        decididoEm: agora,
        decididoPorNome: "Roberto",
        observacaoGestor: "ok, autorizado",
        decisaoIp: "200.1.1.1",
      },
    })
    expect(vi.mocked(registrarAuditoria).mock.calls[0][1].ator).toEqual({ usuarioId: "link-estouro", usuarioNome: "Roberto (via link)" })
  })

  it("link expirado não decide", async () => {
    vi.mocked(prisma.estouroJornada.findUnique).mockResolvedValue({ ...pendente, expiraEm: new Date("2026-10-27T11:00:00Z") } as never)
    await expect(decidirEstouroPorToken(token, "APROVADO", { nome: "R", ip: null }, agora)).rejects.toThrow("expirou")
    expect(tx.estouroJornada.updateMany).not.toHaveBeenCalled()
  })

  it("segundo clique (ou pedido já cancelado) não muda a decisão", async () => {
    vi.mocked(prisma.estouroJornada.findUnique).mockResolvedValue({ ...pendente, status: "RECUSADO" } as never)
    await expect(decidirEstouroPorToken(token, "APROVADO", { nome: "R", ip: null }, agora)).rejects.toThrow("já foi respondido")
  })

  it("dois cliques ao mesmo tempo: o que chega depois não grava", async () => {
    vi.mocked(prisma.estouroJornada.findUnique).mockResolvedValue(pendente as never)
    tx.estouroJornada.updateMany.mockResolvedValue({ count: 0 })
    await expect(decidirEstouroPorToken(token, "RECUSADO", { nome: "R", ip: null }, agora)).rejects.toThrow("já foi respondido")
    expect(registrarAuditoria).not.toHaveBeenCalled()
  })

  it("token desconhecido (ou substituído por um link mais novo)", async () => {
    vi.mocked(prisma.estouroJornada.findUnique).mockResolvedValue(null)
    await expect(decidirEstouroPorToken(token, "APROVADO", { nome: "R", ip: null }, agora)).rejects.toThrow("Link inválido")
  })
})

describe("gerarNovoLinkEstouro / cancelarSolicitacaoEstouro", () => {
  const pendente = {
    id: 5,
    status: "PENDENTE",
    minutosExtras: 60,
    motivos: ["ABASTECER"],
    tokenHash: "antigo",
    motorista: { nome: "JOÃO" },
    viagem: null,
  }

  it("troca o token e renova a validade só de pedido pendente", async () => {
    vi.mocked(prisma.estouroJornada.findFirst).mockResolvedValue(pendente as never)

    const link = await gerarNovoLinkEstouro(FILIAL, 5, ator, { agora })

    const { where, data } = tx.estouroJornada.updateMany.mock.calls[0][0]
    expect(where).toEqual({ id: 5, filialId: FILIAL, status: "PENDENTE" })
    expect(data.tokenHash).toBe(hashDoToken(link.url.split("/").at(-1)!))
    expect(data.tokenHash).not.toBe("antigo")
    expect(data.expiraEm).toEqual(new Date("2026-10-28T00:00:00Z"))
  })

  it("na área do motorista, só acha os pedidos dele", async () => {
    vi.mocked(prisma.estouroJornada.findFirst).mockResolvedValue(pendente as never)
    await gerarNovoLinkEstouro(FILIAL, 5, ator, { doMotorista: 7, agora })
    expect(vi.mocked(prisma.estouroJornada.findFirst).mock.calls[0][0]?.where).toEqual({ id: 5, filialId: FILIAL, motoristaId: 7 })
    expect(tx.estouroJornada.updateMany.mock.calls[0][0].where).toEqual({ id: 5, filialId: FILIAL, motoristaId: 7, status: "PENDENTE" })
  })

  it("motorista não acha pedido de outro motorista", async () => {
    vi.mocked(prisma.estouroJornada.findFirst).mockResolvedValue(null)
    await expect(gerarNovoLinkEstouro(FILIAL, 5, ator, { doMotorista: 8, agora })).rejects.toThrow("não encontrado")
  })

  it("não gera link novo pra pedido já decidido", async () => {
    vi.mocked(prisma.estouroJornada.findFirst).mockResolvedValue({ id: 5, status: "APROVADO" } as never)
    await expect(gerarNovoLinkEstouro(FILIAL, 5, ator, { agora })).rejects.toThrow("já foi encerrado")
  })

  it("cancelar só funciona enquanto pendente", async () => {
    tx.estouroJornada.findFirst.mockResolvedValue({ id: 5, status: "APROVADO" })
    tx.estouroJornada.updateMany.mockResolvedValue({ count: 0 })
    await expect(cancelarSolicitacaoEstouro(FILIAL, 5, ator)).rejects.toThrow("já foi respondido")
  })

  it("motorista cancela só o pedido dele", async () => {
    tx.estouroJornada.findFirst.mockResolvedValue({ id: 5, status: "PENDENTE" })
    await cancelarSolicitacaoEstouro(FILIAL, 5, ator, { doMotorista: 7 })
    expect(tx.estouroJornada.updateMany.mock.calls[0][0].where).toEqual({ id: 5, filialId: FILIAL, motoristaId: 7, status: "PENDENTE" })
  })
})
