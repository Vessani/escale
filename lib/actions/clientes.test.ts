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
    cliente: {
      create: vi.fn(),
      update: vi.fn(),
    },
  },
}))

import { prisma } from "@/lib/prisma"
import { criarCliente, editarCliente, deletarCliente } from "@/lib/actions/clientes"

const clienteValido = { nome: "WEG", exigeIntegracao: true }

describe("lib/actions/clientes — controle de acesso", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe("sem sessão", () => {
    beforeEach(() => {
      vi.mocked(getServerSession).mockResolvedValue(null)
    })

    it("criarCliente recusa e não chama o prisma", async () => {
      const resposta = await criarCliente(clienteValido)

      expect(resposta).toEqual({ sucesso: false, erro: "Não autorizado." })
      expect(prisma.cliente.create).not.toHaveBeenCalled()
    })

    it("editarCliente recusa e não chama o prisma", async () => {
      const resposta = await editarCliente(1, clienteValido)

      expect(resposta.sucesso).toBe(false)
      expect(prisma.cliente.update).not.toHaveBeenCalled()
    })

    it("deletarCliente recusa e não chama o prisma", async () => {
      const resposta = await deletarCliente(1)

      expect(resposta.sucesso).toBe(false)
      expect(prisma.cliente.update).not.toHaveBeenCalled()
    })
  })

  describe("com sessão de DESPACHANTE", () => {
    beforeEach(() => {
      vi.mocked(getServerSession).mockResolvedValue({ user: { id: "1", role: "DESPACHANTE", filialId: 1 } } as never)
    })

    it("criarCliente recusa — cadastro de cliente é restrito a ADMIN", async () => {
      const resposta = await criarCliente(clienteValido)

      expect(resposta).toEqual({ sucesso: false, erro: "Não autorizado." })
      expect(prisma.cliente.create).not.toHaveBeenCalled()
    })

    it("editarCliente recusa", async () => {
      const resposta = await editarCliente(1, clienteValido)

      expect(resposta.sucesso).toBe(false)
      expect(prisma.cliente.update).not.toHaveBeenCalled()
    })

    it("deletarCliente recusa", async () => {
      const resposta = await deletarCliente(1)

      expect(resposta.sucesso).toBe(false)
      expect(prisma.cliente.update).not.toHaveBeenCalled()
    })
  })

  describe("com sessão de ADMIN", () => {
    beforeEach(() => {
      vi.mocked(getServerSession).mockResolvedValue({ user: { id: "1", role: "ADMIN", filialId: 1 } } as never)
    })

    it("criarCliente cria o cliente com os dados validados", async () => {
      vi.mocked(prisma.cliente.create).mockResolvedValue({} as never)

      const resposta = await criarCliente(clienteValido)

      expect(resposta).toEqual({ sucesso: true })
      expect(prisma.cliente.create).toHaveBeenCalledWith({ data: clienteValido })
    })

    it("criarCliente recusa dados inválidos (nome vazio) e não chama o prisma", async () => {
      const resposta = await criarCliente({ nome: "", exigeIntegracao: false })

      expect(resposta.sucesso).toBe(false)
      expect(prisma.cliente.create).not.toHaveBeenCalled()
    })

    it("editarCliente atualiza o registro pelo id", async () => {
      vi.mocked(prisma.cliente.update).mockResolvedValue({} as never)

      const resposta = await editarCliente(7, clienteValido)

      expect(resposta).toEqual({ sucesso: true })
      expect(prisma.cliente.update).toHaveBeenCalledWith({ where: { id: 7 }, data: clienteValido })
    })

    it("deletarCliente marca deletadoEm em vez de apagar o registro", async () => {
      vi.mocked(prisma.cliente.update).mockResolvedValue({} as never)

      const resposta = await deletarCliente(7)

      expect(resposta).toEqual({ sucesso: true })
      expect(prisma.cliente.update).toHaveBeenCalledTimes(1)
      const chamada = vi.mocked(prisma.cliente.update).mock.calls[0][0] as { where: { id: number }; data: { deletadoEm: Date } }
      expect(chamada.where).toEqual({ id: 7 })
      expect(chamada.data.deletadoEm).toBeInstanceOf(Date)
    })

    it("propaga mensagem amigável quando o prisma lança erro (ex: nome duplicado)", async () => {
      vi.mocked(prisma.cliente.create).mockRejectedValue(new Error("boom"))

      const resposta = await criarCliente(clienteValido)

      expect(resposta.sucesso).toBe(false)
      expect(resposta.erro).toBeTruthy()
    })
  })
})
