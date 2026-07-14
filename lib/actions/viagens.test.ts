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

vi.mock("@/lib/services/viagem.service", () => ({
  criarViagemAvulsaService: vi.fn(),
  criarViagemComAlocacaoService: vi.fn(),
  editarViagemService: vi.fn(),
  deletarViagemService: vi.fn(),
  atualizarStatusViagemService: vi.fn(),
  atualizarSaidaRealService: vi.fn(),
}))

vi.mock("@/lib/queries/motoristas", () => ({
  buscarMotoristasParaSelect: vi.fn(),
}))

import * as viagemService from "@/lib/services/viagem.service"
import * as motoristasQueries from "@/lib/queries/motoristas"
import {
  criarViagemAvulsa,
  sugerirAlocacaoParaViagens,
  criarViagensEmLoteComAlocacao,
  editarViagem,
  deletarViagem,
  atualizarStatusViagem,
  atualizarSaidaReal,
} from "@/lib/actions/viagens"

describe("lib/actions/viagens — controle de acesso", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe("sem sessão", () => {
    beforeEach(() => {
      vi.mocked(getServerSession).mockResolvedValue(null)
    })

    it("criarViagemAvulsa recusa e não chama o service", async () => {
      const resposta = await criarViagemAvulsa({} as never)

      expect(resposta).toEqual({ sucesso: false, erro: "Não autorizado." })
      expect(viagemService.criarViagemAvulsaService).not.toHaveBeenCalled()
    })

    it("sugerirAlocacaoParaViagens rejeita e não busca motoristas", async () => {
      await expect(sugerirAlocacaoParaViagens([])).rejects.toThrow("Não autorizado.")
      expect(motoristasQueries.buscarMotoristasParaSelect).not.toHaveBeenCalled()
    })

    it("criarViagensEmLoteComAlocacao recusa e não cria nenhuma viagem", async () => {
      const resultado = await criarViagensEmLoteComAlocacao([{ dados: {} as never, motoristaId: null }])

      expect(resultado.sucesso).toBe(false)
      expect(resultado.criadas).toBe(0)
      expect(resultado.falhas[0].erro).toBe("Não autorizado.")
      expect(viagemService.criarViagemComAlocacaoService).not.toHaveBeenCalled()
    })

    it("editarViagem recusa e não chama o service", async () => {
      const resposta = await editarViagem(1, {} as never)

      expect(resposta).toEqual({ sucesso: false, erro: "Não autorizado." })
      expect(viagemService.editarViagemService).not.toHaveBeenCalled()
    })

    it("deletarViagem recusa e não chama o service", async () => {
      const resposta = await deletarViagem(1)

      expect(resposta).toEqual({ sucesso: false, erro: "Não autorizado." })
      expect(viagemService.deletarViagemService).not.toHaveBeenCalled()
    })

    it("atualizarStatusViagem recusa e não chama o service", async () => {
      const resposta = await atualizarStatusViagem(1, "INICIADA")

      expect(resposta).toEqual({ sucesso: false, erro: "Não autorizado." })
      expect(viagemService.atualizarStatusViagemService).not.toHaveBeenCalled()
    })

    it("atualizarSaidaReal recusa e não chama o service", async () => {
      const resposta = await atualizarSaidaReal(1, { horarioRealSaida: null, motivoAtraso: null })

      expect(resposta).toEqual({ sucesso: false, erro: "Não autorizado." })
      expect(viagemService.atualizarSaidaRealService).not.toHaveBeenCalled()
    })
  })

  describe("com sessão", () => {
    beforeEach(() => {
      vi.mocked(getServerSession).mockResolvedValue({ user: { id: "1" } } as never)
    })

    it("criarViagemAvulsa segue em frente e chama o service", async () => {
      vi.mocked(viagemService.criarViagemAvulsaService).mockResolvedValue({} as never)

      const resposta = await criarViagemAvulsa({} as never)

      expect(resposta).toEqual({ sucesso: true })
      expect(viagemService.criarViagemAvulsaService).toHaveBeenCalledTimes(1)
    })

    it("editarViagem segue em frente e chama o service", async () => {
      vi.mocked(viagemService.editarViagemService).mockResolvedValue({} as never)

      const resposta = await editarViagem(1, {} as never)

      expect(resposta).toEqual({ sucesso: true })
      expect(viagemService.editarViagemService).toHaveBeenCalledTimes(1)
    })
  })
})
