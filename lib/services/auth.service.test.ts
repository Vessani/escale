import { beforeEach, describe, expect, it, vi } from "vitest"
import bcrypt from "bcrypt"

vi.mock("@/lib/prisma", () => ({
  prisma: {
    usuario: { findFirst: vi.fn(), findUnique: vi.fn(), findMany: vi.fn() },
  },
}))

vi.mock("@/lib/services/login.service", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/services/login.service")>()
  return {
    ...original,
    garantirLoginNaoBloqueado: vi.fn(),
    garantirPinNaoBloqueado: vi.fn(),
    registrarFalhaLogin: vi.fn(),
    limparFalhasLogin: vi.fn(),
  }
})

import { prisma } from "@/lib/prisma"
import { garantirLoginNaoBloqueado, LoginBloqueadoError, limparFalhasLogin, registrarFalhaLogin } from "@/lib/services/login.service"
import {
  autenticarMotorista,
  autenticarUsuario,
  MENSAGEM_PIN_INVALIDO,
  DURACAO_SESSAO_SEGUNDOS,
  MENSAGEM_CREDENCIAIS_INVALIDAS,
  MENSAGEM_USUARIO_DESATIVADO,
  revalidarToken,
} from "./auth.service"

const senhaCerta = "senha-certa-123"
const hash = bcrypt.hashSync(senhaCerta, 4)

function usuario(extra: Record<string, unknown> = {}) {
  return { id: "u1", nome: "Ana", email: "ana@ritmo.com", senha: hash, role: "ADMIN", filialId: 1, ativo: true, ...extra }
}

const headers = { "x-forwarded-for": "200.1.1.1, 10.0.0.1" }

describe("autenticarUsuario", () => {
  beforeEach(() => vi.clearAllMocks())

  it("entra com senha certa, normaliza o e-mail e zera as falhas", async () => {
    vi.mocked(prisma.usuario.findFirst).mockResolvedValue(usuario() as never)

    const resultado = await autenticarUsuario({ email: "  Ana@Ritmo.com ", senha: senhaCerta }, headers)

    expect(resultado).toMatchObject({ id: "u1", role: "ADMIN", filialId: 1 })
    expect(garantirLoginNaoBloqueado).toHaveBeenCalledWith("ana@ritmo.com", "200.1.1.1")
    expect(prisma.usuario.findFirst).toHaveBeenCalledWith({
      where: { email: { equals: "ana@ritmo.com", mode: "insensitive" } },
    })
    expect(limparFalhasLogin).toHaveBeenCalledWith("ana@ritmo.com")
    expect(registrarFalhaLogin).not.toHaveBeenCalled()
  })

  it("senha errada registra falha e dá a mesma mensagem de e-mail inexistente", async () => {
    vi.mocked(prisma.usuario.findFirst).mockResolvedValue(usuario() as never)
    await expect(autenticarUsuario({ email: "ana@ritmo.com", senha: "errada" }, headers)).rejects.toThrow(MENSAGEM_CREDENCIAIS_INVALIDAS)

    vi.mocked(prisma.usuario.findFirst).mockResolvedValue(null)
    await expect(autenticarUsuario({ email: "nao@existe.com", senha: "x" }, headers)).rejects.toThrow(MENSAGEM_CREDENCIAIS_INVALIDAS)

    expect(registrarFalhaLogin).toHaveBeenCalledTimes(2)
    expect(limparFalhasLogin).not.toHaveBeenCalled()
  })

  it("bloqueado não chega nem a consultar o usuário", async () => {
    vi.mocked(garantirLoginNaoBloqueado).mockRejectedValueOnce(new LoginBloqueadoError())

    await expect(autenticarUsuario({ email: "ana@ritmo.com", senha: senhaCerta }, headers)).rejects.toThrow(/Muitas tentativas/)
    expect(prisma.usuario.findFirst).not.toHaveBeenCalled()
  })

  it("usuário desativado não entra, mesmo com a senha certa", async () => {
    vi.mocked(prisma.usuario.findFirst).mockResolvedValue(usuario({ ativo: false }) as never)

    await expect(autenticarUsuario({ email: "ana@ritmo.com", senha: senhaCerta }, headers)).rejects.toThrow(MENSAGEM_USUARIO_DESATIVADO)
    expect(limparFalhasLogin).not.toHaveBeenCalled()
  })

  it("exige e-mail e senha", async () => {
    await expect(autenticarUsuario({ email: "", senha: "" }, headers)).rejects.toThrow(/preencha/)
    await expect(autenticarUsuario(undefined, headers)).rejects.toThrow(/preencha/)
  })
})

describe("revalidarToken", () => {
  beforeEach(() => vi.clearAllMocks())
  const agora = Date.UTC(2026, 8, 30, 12)

  it("atualiza papel e filial com o que está no banco", async () => {
    vi.mocked(prisma.usuario.findUnique).mockResolvedValue({ ativo: true, role: "DESPACHANTE", filialId: 2, versaoSessao: 0 } as never)

    const token = await revalidarToken({ id: "u1", role: "ADMIN", filialId: 1, loginEm: agora - 1000 }, agora)

    expect(token).toMatchObject({ role: "DESPACHANTE", filialId: 2 })
  })

  it("derruba usuário desativado ou apagado", async () => {
    vi.mocked(prisma.usuario.findUnique).mockResolvedValueOnce({ ativo: false, role: "ADMIN", filialId: 1, versaoSessao: 0 } as never)
    await expect(revalidarToken({ id: "u1", role: "ADMIN", filialId: 1, loginEm: agora }, agora)).rejects.toThrow()

    vi.mocked(prisma.usuario.findUnique).mockResolvedValueOnce(null)
    await expect(revalidarToken({ id: "u1", role: "ADMIN", filialId: 1, loginEm: agora }, agora)).rejects.toThrow()
  })

  it("expira 12h depois do login, mesmo usando o sistema", async () => {
    vi.mocked(prisma.usuario.findUnique).mockResolvedValue({ ativo: true, role: "ADMIN", filialId: 1, versaoSessao: 0 } as never)
    const limite = DURACAO_SESSAO_SEGUNDOS * 1000

    await expect(revalidarToken({ id: "u1", role: "ADMIN", filialId: 1, loginEm: agora - limite + 60_000 }, agora)).resolves.toBeTruthy()
    await expect(revalidarToken({ id: "u1", role: "ADMIN", filialId: 1, loginEm: agora - limite - 1 }, agora)).rejects.toThrow(/expirada/)
  })

  it("token antigo, sem loginEm, é tratado como expirado", async () => {
    await expect(revalidarToken({ id: "u1", role: "ADMIN", filialId: 1 }, agora)).rejects.toThrow(/expirada/)
    expect(prisma.usuario.findUnique).not.toHaveBeenCalled()
  })
})

describe("autenticarMotorista (SEVA + PIN)", () => {
  beforeEach(() => vi.clearAllMocks())
  const pinCerto = "482913"
  const acesso = (extra: Record<string, unknown> = {}) => ({
    id: "m1",
    senha: bcrypt.hashSync(pinCerto, 4),
    ativo: true,
    motorista: { id: 42, nome: "JOSE SILVA", filialId: 3 },
    ...extra,
  })

  it("entra com matrícula e PIN certos, como MOTORISTA da filial do cadastro", async () => {
    vi.mocked(prisma.usuario.findMany).mockResolvedValue([acesso()] as never)

    const resultado = await autenticarMotorista({ seva: " 261 ", pin: pinCerto }, headers)

    expect(resultado).toEqual({ id: "m1", name: "JOSE SILVA", email: null, role: "MOTORISTA", filialId: 3, motoristaId: 42 })
    expect(garantirLoginNaoBloqueado).toHaveBeenCalledWith("motorista:261", "200.1.1.1")
    expect(limparFalhasLogin).toHaveBeenCalledWith("motorista:261")
  })

  it("PIN errado ou matrícula sem acesso: mesma mensagem e conta tentativa", async () => {
    vi.mocked(prisma.usuario.findMany).mockResolvedValue([acesso()] as never)
    await expect(autenticarMotorista({ seva: "261", pin: "000000" }, headers)).rejects.toThrow(MENSAGEM_PIN_INVALIDO)

    vi.mocked(prisma.usuario.findMany).mockResolvedValue([] as never)
    await expect(autenticarMotorista({ seva: "999", pin: pinCerto }, headers)).rejects.toThrow(MENSAGEM_PIN_INVALIDO)

    expect(registrarFalhaLogin).toHaveBeenCalledTimes(2)
  })

  it("mesma matrícula em duas filiais: entra no acesso cujo PIN bate", async () => {
    vi.mocked(prisma.usuario.findMany).mockResolvedValue([
      acesso({ id: "outro", senha: bcrypt.hashSync("111111", 4), motorista: { id: 7, nome: "OUTRO", filialId: 9 } }),
      acesso(),
    ] as never)

    expect(await autenticarMotorista({ seva: "261", pin: pinCerto }, headers)).toMatchObject({ id: "m1", filialId: 3 })
  })

  it("acesso desativado não entra; matrícula não numérica nem consulta o banco", async () => {
    vi.mocked(prisma.usuario.findMany).mockResolvedValue([acesso({ ativo: false })] as never)
    await expect(autenticarMotorista({ seva: "261", pin: pinCerto }, headers)).rejects.toThrow(MENSAGEM_USUARIO_DESATIVADO)

    vi.clearAllMocks()
    await expect(autenticarMotorista({ seva: "abc", pin: pinCerto }, headers)).rejects.toThrow("Preencha a matrícula")
    expect(prisma.usuario.findMany).not.toHaveBeenCalled()
  })
})

describe("autenticarUsuario — sem @", () => {
  beforeEach(() => vi.clearAllMocks())

  it("texto sem @ é recusado antes de contar tentativa (não dá pra travar o PIN de um motorista pelo login de e-mail)", async () => {
    await expect(autenticarUsuario({ email: "motorista:261", senha: "x" }, headers)).rejects.toThrow(MENSAGEM_CREDENCIAIS_INVALIDAS)
    expect(garantirLoginNaoBloqueado).not.toHaveBeenCalled()
    expect(registrarFalhaLogin).not.toHaveBeenCalled()
    expect(prisma.usuario.findFirst).not.toHaveBeenCalled()
  })
})

describe("revalidarToken — versão da sessão", () => {
  beforeEach(() => vi.clearAllMocks())

  it("PIN novo (versão subiu) derruba a sessão antiga; token antigo sem versão vale como 0", async () => {
    const agora = Date.now()
    vi.mocked(prisma.usuario.findUnique).mockResolvedValue({
      ativo: true,
      role: "MOTORISTA",
      filialId: 3,
      motoristaId: 42,
      versaoSessao: 1,
      motorista: { deletadoEm: null },
    } as never)
    await expect(revalidarToken({ id: "m1", role: "MOTORISTA", filialId: 3, loginEm: agora, versaoSessao: 0 }, agora)).rejects.toThrow(
      "PIN novo",
    )
    await expect(revalidarToken({ id: "m1", role: "MOTORISTA", filialId: 3, loginEm: agora }, agora)).rejects.toThrow("PIN novo")
    await expect(
      revalidarToken({ id: "m1", role: "MOTORISTA", filialId: 3, loginEm: agora, versaoSessao: 1 }, agora),
    ).resolves.toMatchObject({ motoristaId: 42 })
  })
})

describe("revalidarToken — motorista", () => {
  beforeEach(() => vi.clearAllMocks())
  const token = { id: "m1", role: "MOTORISTA", filialId: 3, loginEm: Date.now() }

  it("motorista excluído do cadastro perde a sessão na hora", async () => {
    vi.mocked(prisma.usuario.findUnique).mockResolvedValue({
      ativo: true,
      role: "MOTORISTA",
      filialId: 3,
      motoristaId: 42,
      versaoSessao: 0,
      motorista: { deletadoEm: new Date() },
    } as never)
    await expect(revalidarToken({ ...token })).rejects.toThrow("Motorista excluído")
  })

  it("mantém o motoristaId no token", async () => {
    vi.mocked(prisma.usuario.findUnique).mockResolvedValue({
      ativo: true,
      role: "MOTORISTA",
      filialId: 3,
      motoristaId: 42,
      versaoSessao: 0,
      motorista: { deletadoEm: null },
    } as never)
    expect(await revalidarToken({ ...token })).toMatchObject({ motoristaId: 42 })
  })
})
