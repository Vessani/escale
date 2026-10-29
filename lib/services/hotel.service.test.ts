import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: vi.fn(),
    motorista: { findFirst: vi.fn() },
    viagem: { findFirst: vi.fn() },
    solicitacaoHotel: { findFirst: vi.fn(), findUnique: vi.fn() },
  },
}))
vi.mock("@/lib/services/auditoria.service", () => ({ registrarAuditoria: vi.fn() }))

import { prisma } from "@/lib/prisma"
import { registrarAuditoria } from "@/lib/services/auditoria.service"
import { cancelarSolicitacaoHotel, criarSolicitacaoHotel, decidirHotelPorToken, gerarNovoLinkHotel } from "./hotel.service"
import { hashDoToken } from "./link-aprovacao"

const FILIAL = 3
const ator = { usuarioId: "u1", usuarioNome: "Alan" }
const agora = new Date("2026-10-27T12:00:00Z")

const tx = {
  solicitacaoHotel: {
    create: vi.fn(),
    updateMany: vi.fn(),
    findFirst: vi.fn(),
    findUniqueOrThrow: vi.fn().mockResolvedValue({ id: 5, tokenHash: "x" }),
  },
}

const dados = (parcial: Record<string, unknown> = {}) => ({
  motoristaId: 7,
  viagemId: null as number | null,
  cidade: "Curitiba",
  nomeHotel: "Hotel Ibis Curitiba Centro",
  dataPernoite: "2026-10-27",
  ...parcial,
})

beforeEach(() => {
  vi.clearAllMocks()
  process.env.NEXTAUTH_URL = "https://escalador.test/"
  vi.mocked(prisma.$transaction).mockImplementation(((cb: (t: unknown) => unknown) => Promise.resolve(cb(tx))) as never)
  vi.mocked(prisma.motorista.findFirst).mockResolvedValue({ id: 7, nome: "JOÃO DA SILVA" } as never)
  vi.mocked(prisma.solicitacaoHotel.findFirst).mockResolvedValue(null)
  tx.solicitacaoHotel.create.mockImplementation(({ data }: { data: Record<string, unknown> }) => Promise.resolve({ id: 5, ...data }))
  tx.solicitacaoHotel.updateMany.mockResolvedValue({ count: 1 })
})

describe("criarSolicitacaoHotel", () => {
  it("grava cidade e hotel com o hash do token e validade de 12h, e devolve o link do WhatsApp", async () => {
    const link = await criarSolicitacaoHotel(FILIAL, dados(), ator, { agora })

    const { data } = tx.solicitacaoHotel.create.mock.calls[0][0]
    expect(data).toMatchObject({
      filialId: FILIAL,
      motoristaId: 7,
      cidade: "Curitiba",
      nomeHotel: "Hotel Ibis Curitiba Centro",
      dataPernoite: new Date("2026-10-27T00:00:00Z"),
      solicitadoPorNome: "Alan",
      pedidoPeloMotorista: false,
      expiraEm: new Date("2026-10-28T00:00:00Z"),
    })
    expect(link.url.startsWith("https://escalador.test/aprovar-hotel/")).toBe(true)
    expect(data.tokenHash).toBe(hashDoToken(link.url.split("/").at(-1)!))

    const mensagem = decodeURIComponent(link.linkWhatsApp.split("?text=")[1])
    expect(mensagem).toContain("*Solicitação de hotel (pernoite)*")
    expect(mensagem).toContain("Motorista: JOÃO DA SILVA")
    expect(mensagem).toContain("Cidade: Curitiba")
    expect(mensagem).toContain("Hotel: Hotel Ibis Curitiba Centro")
    expect(mensagem).toContain("Pernoite: 27/10/2026 (ter)")
    expect(mensagem).toContain(link.url)

    // A auditoria nunca recebe o hash do token.
    expect(vi.mocked(registrarAuditoria).mock.calls[0][1].depois).not.toHaveProperty("tokenHash")
  })

  it("marca quando foi o próprio motorista que pediu", async () => {
    await criarSolicitacaoHotel(FILIAL, dados(), ator, { pedidoPeloMotorista: true, agora })
    expect(tx.solicitacaoHotel.create.mock.calls[0][0].data.pedidoPeloMotorista).toBe(true)
  })

  it("recusa viagem que não é do motorista e motorista de outra filial", async () => {
    vi.mocked(prisma.viagem.findFirst).mockResolvedValue(null)
    await expect(criarSolicitacaoHotel(FILIAL, dados({ viagemId: 99 }), ator, { agora })).rejects.toThrow("não é desse motorista")

    vi.mocked(prisma.motorista.findFirst).mockResolvedValue(null)
    await expect(criarSolicitacaoHotel(FILIAL, dados(), ator, { agora })).rejects.toThrow("Motorista não encontrado")
    expect(tx.solicitacaoHotel.create).not.toHaveBeenCalled()
  })

  it("data do pernoite: de ontem até 30 dias pra frente, no dia de Brasília", async () => {
    // 12:00 UTC = 09:00 em Brasília, dia 27/10.
    await expect(criarSolicitacaoHotel(FILIAL, dados({ dataPernoite: "2026-10-26" }), ator, { agora })).resolves.toBeDefined()
    await expect(criarSolicitacaoHotel(FILIAL, dados({ dataPernoite: "2026-11-26" }), ator, { agora })).resolves.toBeDefined()
    await expect(criarSolicitacaoHotel(FILIAL, dados({ dataPernoite: "2026-10-25" }), ator, { agora })).rejects.toThrow("já passou")
    await expect(criarSolicitacaoHotel(FILIAL, dados({ dataPernoite: "2026-11-27" }), ator, { agora })).rejects.toThrow("30 dias")

    // 02:00 UTC do dia 28 ainda é 23:00 do dia 27 em Brasília: "ontem" é 26/10.
    const madrugadaUtc = new Date("2026-10-28T02:00:00Z")
    await expect(criarSolicitacaoHotel(FILIAL, dados({ dataPernoite: "2026-10-26" }), ator, { agora: madrugadaUtc })).resolves.toBeDefined()
  })

  it("não deixa abrir um segundo pedido enquanto o primeiro está com o gestor", async () => {
    vi.mocked(prisma.solicitacaoHotel.findFirst).mockResolvedValue({ id: 1 } as never)
    await expect(criarSolicitacaoHotel(FILIAL, dados(), ator, { agora })).rejects.toThrow("aguardando o gestor")
    expect(prisma.solicitacaoHotel.findFirst).toHaveBeenCalledWith({
      where: { filialId: FILIAL, motoristaId: 7, status: "PENDENTE", expiraEm: { gt: agora } },
      select: { id: true },
    })
  })
})

describe("decidirHotelPorToken", () => {
  const token = "a".repeat(43)
  const pendente = {
    id: 5,
    filialId: FILIAL,
    status: "PENDENTE",
    expiraEm: new Date("2026-10-27T20:00:00Z"),
    tokenHash: hashDoToken(token),
  }

  it("aprova só se pendente e dentro da validade, gravando nome, hora, IP e observação", async () => {
    vi.mocked(prisma.solicitacaoHotel.findUnique).mockResolvedValue(pendente as never)

    await expect(
      decidirHotelPorToken(token, "APROVADO", { nome: " Roberto ", observacao: " pode reservar ", ip: "200.1.1.1" }, agora),
    ).resolves.toEqual({
      decisao: "APROVADO",
    })
    expect(tx.solicitacaoHotel.updateMany).toHaveBeenCalledWith({
      where: { id: 5, tokenHash: hashDoToken(token), status: "PENDENTE", expiraEm: { gt: agora } },
      data: {
        status: "APROVADO",
        decididoEm: agora,
        decididoPorNome: "Roberto",
        observacaoGestor: "pode reservar",
        decisaoIp: "200.1.1.1",
      },
    })
    expect(vi.mocked(registrarAuditoria).mock.calls[0][1].ator).toEqual({ usuarioId: "link-hotel", usuarioNome: "Roberto (via link)" })
  })

  it("link expirado, já decidido ou desconhecido não decide", async () => {
    vi.mocked(prisma.solicitacaoHotel.findUnique).mockResolvedValue({ ...pendente, expiraEm: new Date("2026-10-27T11:00:00Z") } as never)
    await expect(decidirHotelPorToken(token, "APROVADO", { nome: "R", ip: null }, agora)).rejects.toThrow("expirou")

    vi.mocked(prisma.solicitacaoHotel.findUnique).mockResolvedValue({ ...pendente, status: "CANCELADO" } as never)
    await expect(decidirHotelPorToken(token, "APROVADO", { nome: "R", ip: null }, agora)).rejects.toThrow("já foi respondido")

    vi.mocked(prisma.solicitacaoHotel.findUnique).mockResolvedValue(null)
    await expect(decidirHotelPorToken(token, "APROVADO", { nome: "R", ip: null }, agora)).rejects.toThrow("Link inválido")
    expect(tx.solicitacaoHotel.updateMany).not.toHaveBeenCalled()
  })

  it("dois cliques ao mesmo tempo: o que chega depois não grava", async () => {
    vi.mocked(prisma.solicitacaoHotel.findUnique).mockResolvedValue(pendente as never)
    tx.solicitacaoHotel.updateMany.mockResolvedValue({ count: 0 })
    await expect(decidirHotelPorToken(token, "RECUSADO", { nome: "R", ip: null }, agora)).rejects.toThrow("já foi respondido")
    expect(registrarAuditoria).not.toHaveBeenCalled()
  })
})

describe("gerarNovoLinkHotel / cancelarSolicitacaoHotel", () => {
  const pendente = {
    id: 5,
    status: "PENDENTE",
    cidade: "Lages",
    nomeHotel: "Hotel Serrano",
    dataPernoite: new Date("2026-10-28T00:00:00Z"),
    tokenHash: "antigo",
    motorista: { nome: "JOÃO" },
    viagem: null,
  }

  it("troca o token e renova a validade, e na área do motorista só acha os pedidos dele", async () => {
    vi.mocked(prisma.solicitacaoHotel.findFirst).mockResolvedValue(pendente as never)

    const link = await gerarNovoLinkHotel(FILIAL, 5, ator, { doMotorista: 7, agora })

    expect(vi.mocked(prisma.solicitacaoHotel.findFirst).mock.calls[0][0]?.where).toEqual({ id: 5, filialId: FILIAL, motoristaId: 7 })
    const { where, data } = tx.solicitacaoHotel.updateMany.mock.calls[0][0]
    expect(where).toEqual({ id: 5, filialId: FILIAL, motoristaId: 7, status: "PENDENTE" })
    expect(data.tokenHash).toBe(hashDoToken(link.url.split("/").at(-1)!))
    expect(data.expiraEm).toEqual(new Date("2026-10-28T00:00:00Z"))
    expect(decodeURIComponent(link.linkWhatsApp)).toContain("Hotel: Hotel Serrano")
  })

  it("não gera link novo pra pedido já decidido", async () => {
    vi.mocked(prisma.solicitacaoHotel.findFirst).mockResolvedValue({ ...pendente, status: "APROVADO" } as never)
    await expect(gerarNovoLinkHotel(FILIAL, 5, ator, { agora })).rejects.toThrow("já foi encerrado")
  })

  it("cancelar só funciona enquanto pendente", async () => {
    tx.solicitacaoHotel.findFirst.mockResolvedValue({ id: 5, status: "APROVADO" })
    tx.solicitacaoHotel.updateMany.mockResolvedValue({ count: 0 })
    await expect(cancelarSolicitacaoHotel(FILIAL, 5, ator)).rejects.toThrow("já foi respondido")
  })
})
