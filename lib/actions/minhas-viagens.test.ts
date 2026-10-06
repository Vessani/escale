import { beforeEach, describe, expect, it, vi } from "vitest"
import { getServerSession } from "next-auth"

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }))
vi.mock("@/lib/auth", () => ({ authOptions: {} }))
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))
vi.mock("@/lib/services/minhas-viagens.service", () => ({
  iniciarMinhaViagem: vi.fn(),
  adicionarMinhaDespesa: vi.fn(),
  removerMinhaDespesa: vi.fn(),
  encerrarMinhaViagem: vi.fn(),
  registrarChegadaCliente: vi.fn(),
  informarProblemaMecanico: vi.fn(),
}))
vi.mock("@/lib/services/troca-motorista.service", () => ({ trocarMotoristaDaViagem: vi.fn() }))

import { revalidatePath } from "next/cache"
import * as servico from "@/lib/services/minhas-viagens.service"
import { trocarMotoristaDaViagem } from "@/lib/services/troca-motorista.service"
import { ErroDeDominio } from "@/lib/errors"
import { encerrarViagem, iniciarViagem, informarProblema, lancarDespesa, passarViagem } from "./minhas-viagens"

const sessao = (user: Record<string, unknown> | null) =>
  vi.mocked(getServerSession).mockResolvedValue(user ? ({ user } as never) : null)
const motorista = { id: "u9", name: "João", role: "MOTORISTA", filialId: 3, motoristaId: 7 }
const ator = { usuarioId: "u9", usuarioNome: "João" }

beforeEach(() => {
  vi.clearAllMocks()
  sessao(motorista)
})

describe("lib/actions/minhas-viagens", () => {
  it("só o motorista logado e ligado a um cadastro usa a área dele", async () => {
    for (const user of [null, { id: "a", role: "ADMIN", filialId: 3 }, { ...motorista, motoristaId: null }]) {
      sessao(user)
      expect(await iniciarViagem(5, { kmInicial: 100, motivoAtraso: null })).toEqual({ sucesso: false, erro: "Não autorizado." })
    }
    expect(servico.iniciarMinhaViagem).not.toHaveBeenCalled()
  })

  it("inicia com o motorista e a filial da sessão (nunca do cliente) e atualiza Dashboard e viagens", async () => {
    expect(await iniciarViagem(5, { kmInicial: 152300, motivoAtraso: "Fila no carregamento" })).toEqual({ sucesso: true })
    expect(servico.iniciarMinhaViagem).toHaveBeenCalledWith(3, 7, 5, expect.objectContaining({ kmInicial: 152300, motivoAtraso: "Fila no carregamento" }), ator)
    for (const caminho of ["/minhas-viagens", "/minhas-viagens/5", "/", "/viagens"]) expect(revalidatePath).toHaveBeenCalledWith(caminho)
  })

  it("recusa entrada fora do limite sem chamar o service", async () => {
    expect((await iniciarViagem(5, { kmInicial: -10, motivoAtraso: null })).sucesso).toBe(false)
    expect((await iniciarViagem(5, { kmInicial: 100, motivoAtraso: "x".repeat(201) })).sucesso).toBe(false)
    expect((await lancarDespesa(5, { tipo: "PEDAGIO", valorCentavos: 0 })).sucesso).toBe(false)
    expect((await encerrarViagem(0, { kmFinal: 100 })).sucesso).toBe(false)
    expect((await informarProblema(5, "x".repeat(5000))).sucesso).toBe(false)
    expect(servico.iniciarMinhaViagem).not.toHaveBeenCalled()
    expect(servico.adicionarMinhaDespesa).not.toHaveBeenCalled()
    expect(servico.encerrarMinhaViagem).not.toHaveBeenCalled()
    expect(servico.informarProblemaMecanico).not.toHaveBeenCalled()
  })

  it("viagem que mudou no despacho: mensagem do domínio, telas não recarregam", async () => {
    vi.mocked(servico.encerrarMinhaViagem).mockRejectedValueOnce(new ErroDeDominio("VIAGEM_MUDOU", "A viagem foi alterada pelo despacho."))
    expect(await encerrarViagem(5, { kmFinal: 152780 })).toEqual({ sucesso: false, erro: "A viagem foi alterada pelo despacho." })
    expect(revalidatePath).not.toHaveBeenCalled()
  })

  it("passar a viagem: só se ele for o motorista atual, com o horário em Brasília", async () => {
    const resposta = await passarViagem(5, { motoristaNovoId: 8, km: 152500, trocadoEm: "2026-10-02T14:00", local: "Posto BR-101", motivo: "Fim da jornada" })
    expect(resposta).toEqual({ sucesso: true })
    const [filialId, viagemId, dados, , opcoes] = vi.mocked(trocarMotoristaDaViagem).mock.calls[0]
    expect([filialId, viagemId]).toEqual([3, 5])
    expect(dados.trocadoEm).toEqual(new Date("2026-10-02T14:00:00-03:00"))
    expect(opcoes).toEqual({ exigirMotoristaAtual: 7 })
  })
})
