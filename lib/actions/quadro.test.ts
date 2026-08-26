import { describe, expect, it, vi, beforeEach } from "vitest"
import { getServerSession } from "next-auth"

vi.mock("next-auth", () => ({
  getServerSession: vi.fn(),
}))

vi.mock("@/lib/auth", () => ({
  authOptions: {},
}))

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}))

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: vi.fn(),
    quadroObservacao: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
    },
  },
}))

import { prisma } from "@/lib/prisma"
import { atualizarObservacoes } from "@/lib/actions/quadro"

function criarTx() {
  return {
    quadroObservacao: { upsert: vi.fn() },
    registroAuditoria: { create: vi.fn() },
  }
}

type Tx = ReturnType<typeof criarTx>

/** Faz `prisma.$transaction(callback)` invocar `callback(tx)` — o cast contorna a assinatura real (sobrecarregada) do Prisma, que não importa aqui. */
function usarTransacaoCom(tx: Tx) {
  vi.mocked(prisma.$transaction).mockImplementation(((callback: (tx: Tx) => unknown) =>
    Promise.resolve(callback(tx))) as never)
}

describe("lib/actions/quadro — atualizarObservacoes", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("recusa sem sessão e não chama o prisma", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null)

    const resposta = await atualizarObservacoes("novo texto")

    expect(resposta.sucesso).toBe(false)
    expect(prisma.quadroObservacao.upsert).not.toHaveBeenCalled()
  })

  it("recusa SUPERADMIN — não tem filial pra ter quadro de observações", async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: "1", role: "SUPERADMIN", filialId: null } } as never)

    const resposta = await atualizarObservacoes("novo texto")

    expect(resposta.sucesso).toBe(false)
    expect(prisma.quadroObservacao.upsert).not.toHaveBeenCalled()
  })

  it("faz upsert do quadro da filial do usuário logado", async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: "1", role: "DESPACHANTE", filialId: 3 } } as never)
    vi.mocked(prisma.quadroObservacao.findUnique).mockResolvedValue(null)
    const tx = criarTx()
    vi.mocked(tx.quadroObservacao.upsert).mockResolvedValue({ filialId: 3, texto: "aviso importante" })
    usarTransacaoCom(tx)

    const resposta = await atualizarObservacoes("aviso importante")

    expect(resposta).toEqual({ sucesso: true })
    expect(tx.quadroObservacao.upsert).toHaveBeenCalledWith({
      where: { filialId: 3 },
      create: { filialId: 3, texto: "aviso importante" },
      update: { texto: "aviso importante" },
    })
    // Sem quadro anterior — a auditoria registra como criação, não atualização.
    const auditoria = vi.mocked(tx.registroAuditoria.create).mock.calls[0][0] as { data: { acao: string; entidadeId: string } }
    expect(auditoria.data.acao).toBe("CRIACAO")
    expect(auditoria.data.entidadeId).toBe("3")
  })

  it("propaga mensagem amigável quando o prisma falha", async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: "1", role: "DESPACHANTE", filialId: 3 } } as never)
    vi.mocked(prisma.quadroObservacao.findUnique).mockResolvedValue(null)
    const tx = criarTx()
    vi.mocked(tx.quadroObservacao.upsert).mockRejectedValue(new Error("boom"))
    usarTransacaoCom(tx)

    const resposta = await atualizarObservacoes("texto")

    expect(resposta.sucesso).toBe(false)
    expect(resposta.erro).toBeTruthy()
  })
})
