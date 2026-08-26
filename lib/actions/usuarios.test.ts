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

vi.mock("bcrypt", () => ({
  default: {
    hash: vi.fn(),
    compare: vi.fn(),
  },
}))

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: vi.fn(),
    usuario: {
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}))

import bcrypt from "bcrypt"
import { prisma } from "@/lib/prisma"
import { criarUsuario, trocarSenhaPropria } from "@/lib/actions/usuarios"

const usuarioValido = { nome: "Maria Souza", email: "maria@transportadora.com", senha: "12345678", role: "DESPACHANTE" as const, filialId: 1 }

function criarTx() {
  return {
    usuario: { create: vi.fn(), update: vi.fn() },
    registroAuditoria: { create: vi.fn() },
  }
}

type Tx = ReturnType<typeof criarTx>

/** Faz `prisma.$transaction(callback)` invocar `callback(tx)` — o cast contorna a assinatura real (sobrecarregada) do Prisma, que não importa aqui. */
function usarTransacaoCom(tx: Tx) {
  vi.mocked(prisma.$transaction).mockImplementation(((callback: (tx: Tx) => unknown) =>
    Promise.resolve(callback(tx))) as never)
}

describe("lib/actions/usuarios — criarUsuario (controle de acesso)", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("recusa sem sessão e não chama o prisma", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null)

    const resposta = await criarUsuario(usuarioValido)

    expect(resposta).toEqual({ sucesso: false, erro: "Não autorizado." })
    expect(prisma.usuario.create).not.toHaveBeenCalled()
  })

  it("recusa para ADMIN — provisionar usuário é exclusivo de SUPERADMIN", async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: "1", role: "ADMIN", filialId: 1 } } as never)

    const resposta = await criarUsuario(usuarioValido)

    expect(resposta).toEqual({ sucesso: false, erro: "Não autorizado." })
    expect(prisma.usuario.create).not.toHaveBeenCalled()
  })

  describe("com sessão de SUPERADMIN", () => {
    beforeEach(() => {
      vi.mocked(getServerSession).mockResolvedValue({ user: { id: "admin-1", role: "SUPERADMIN", filialId: null } } as never)
    })

    it("cria o usuário com a senha hasheada", async () => {
      vi.mocked(bcrypt.hash).mockResolvedValue("hash-fake" as never)
      const tx = criarTx()
      vi.mocked(tx.usuario.create).mockResolvedValue({ id: "u2", nome: "Maria Souza", email: "maria@transportadora.com", role: "DESPACHANTE", filialId: 1 })
      usarTransacaoCom(tx)

      const resposta = await criarUsuario(usuarioValido)

      expect(resposta).toEqual({ sucesso: true })
      expect(bcrypt.hash).toHaveBeenCalledWith("12345678", 10)
      expect(tx.usuario.create).toHaveBeenCalledWith({
        data: {
          nome: "Maria Souza",
          email: "maria@transportadora.com",
          senha: "hash-fake",
          role: "DESPACHANTE",
          filialId: 1,
        },
      })
      // A auditoria nunca recebe a senha/hash — só campos não sensíveis.
      const auditoria = vi.mocked(tx.registroAuditoria.create).mock.calls[0][0] as { data: { depois: unknown } }
      expect(JSON.stringify(auditoria.data.depois)).not.toContain("hash-fake")
    })

    it("grava filialId null para role SUPERADMIN, mesmo se filialId vier preenchido no formulário", async () => {
      vi.mocked(bcrypt.hash).mockResolvedValue("hash-fake" as never)
      const tx = criarTx()
      vi.mocked(tx.usuario.create).mockResolvedValue({ id: "u3", nome: "Maria Souza", email: "maria@transportadora.com", role: "SUPERADMIN", filialId: null })
      usarTransacaoCom(tx)

      await criarUsuario({ ...usuarioValido, role: "SUPERADMIN", filialId: 1 })

      const chamada = vi.mocked(tx.usuario.create).mock.calls[0][0] as { data: { filialId: number | null } }
      expect(chamada.data.filialId).toBeNull()
    })

    it("recusa senha curta (menos de 8 caracteres) e não chama o prisma", async () => {
      const resposta = await criarUsuario({ ...usuarioValido, senha: "123" })

      expect(resposta.sucesso).toBe(false)
      expect(prisma.usuario.create).not.toHaveBeenCalled()
    })

    it("recusa ADMIN/DESPACHANTE sem filial selecionada", async () => {
      const resposta = await criarUsuario({ ...usuarioValido, filialId: null })

      expect(resposta.sucesso).toBe(false)
      expect(prisma.usuario.create).not.toHaveBeenCalled()
    })
  })
})

describe("lib/actions/usuarios — trocarSenhaPropria", () => {
  const dadosTroca = { senhaAtual: "senhaAntiga1", novaSenha: "senhaNova123", confirmarSenha: "senhaNova123" }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("recusa sem sessão e não consulta o usuário", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null)

    const resposta = await trocarSenhaPropria(dadosTroca)

    expect(resposta).toEqual({ sucesso: false, erro: "Não autorizado." })
    expect(prisma.usuario.findUnique).not.toHaveBeenCalled()
  })

  describe("com sessão (qualquer papel — é self-service)", () => {
    beforeEach(() => {
      vi.mocked(getServerSession).mockResolvedValue({ user: { id: "user-1", role: "DESPACHANTE", filialId: 1 } } as never)
    })

    it("recusa quando a nova senha e a confirmação não coincidem", async () => {
      const resposta = await trocarSenhaPropria({ ...dadosTroca, confirmarSenha: "outraSenha" })

      expect(resposta.sucesso).toBe(false)
      expect(resposta.erro).toMatch(/não coincidem/i)
      expect(prisma.usuario.findUnique).not.toHaveBeenCalled()
    })

    it("recusa nova senha curta (menos de 8 caracteres)", async () => {
      const resposta = await trocarSenhaPropria({ ...dadosTroca, novaSenha: "123", confirmarSenha: "123" })

      expect(resposta.sucesso).toBe(false)
      expect(prisma.usuario.findUnique).not.toHaveBeenCalled()
    })

    it("recusa quando a senha atual informada não confere com o hash salvo", async () => {
      vi.mocked(prisma.usuario.findUnique).mockResolvedValue({ id: "user-1", senha: "hash-salvo" } as never)
      vi.mocked(bcrypt.compare).mockResolvedValue(false as never)

      const resposta = await trocarSenhaPropria(dadosTroca)

      expect(resposta).toEqual({ sucesso: false, erro: "Senha atual incorreta." })
      expect(prisma.usuario.update).not.toHaveBeenCalled()
    })

    it("troca a senha quando a atual confere, buscando e atualizando pelo id da sessão", async () => {
      vi.mocked(prisma.usuario.findUnique).mockResolvedValue({ id: "user-1", senha: "hash-salvo" } as never)
      vi.mocked(bcrypt.compare).mockResolvedValue(true as never)
      vi.mocked(bcrypt.hash).mockResolvedValue("hash-novo" as never)
      const tx = criarTx()
      vi.mocked(tx.usuario.update).mockResolvedValue({ id: "user-1" })
      usarTransacaoCom(tx)

      const resposta = await trocarSenhaPropria(dadosTroca)

      expect(resposta).toEqual({ sucesso: true })
      expect(prisma.usuario.findUnique).toHaveBeenCalledWith({ where: { id: "user-1" } })
      expect(bcrypt.compare).toHaveBeenCalledWith("senhaAntiga1", "hash-salvo")
      expect(bcrypt.hash).toHaveBeenCalledWith("senhaNova123", 10)
      expect(tx.usuario.update).toHaveBeenCalledWith({ where: { id: "user-1" }, data: { senha: "hash-novo" } })
      // A auditoria da troca de senha não carrega antes/depois nenhum — só o fato de ter mudado.
      const auditoria = vi.mocked(tx.registroAuditoria.create).mock.calls[0][0] as { data: { antes: unknown; depois: unknown } }
      expect(auditoria.data.antes).toBeUndefined()
      expect(auditoria.data.depois).toBeUndefined()
    })

    it("recusa quando o usuário da sessão não existe mais ou não tem senha cadastrada", async () => {
      vi.mocked(prisma.usuario.findUnique).mockResolvedValue({ id: "user-1", senha: null } as never)

      const resposta = await trocarSenhaPropria(dadosTroca)

      expect(resposta).toEqual({ sucesso: false, erro: "Usuário inválido." })
      expect(prisma.usuario.update).not.toHaveBeenCalled()
    })
  })
})
