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

vi.mock("@/lib/queries/clientes", () => ({
  buscarNumerosSapQueExigemIntegracao: vi.fn(),
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

const viagemValida = {
  numViagem: "123",
  carreta: "ABC123",
  cavalo: "XYZ456",
  tanque: "TANQUE1",
  diasViagem: 1,
  inicioPrevisto: "2026-08-12T08:00",
  fimPrevisto: "2026-08-13T08:00",
  turno: "MANHA",
  produto: "CO2",
  entregas: [
    {
      dataEntrega: "2026-08-12T08:00",
      cliente: "Cliente Teste",
      cidade: "Cidade Teste",
      uf: "SC",
      kg: 10,
      m3: 1,
      obs: "Observação teste",
      sapcode: "",
      codewhite: "",
    },
  ],
}

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
      vi.mocked(getServerSession).mockResolvedValue({ user: { id: "1", role: "DESPACHANTE" } } as never)
    })

    it("criarViagemAvulsa segue em frente e chama o service", async () => {
      vi.mocked(viagemService.criarViagemAvulsaService).mockResolvedValue({} as never)

      const resposta = await criarViagemAvulsa(viagemValida as never)

      expect(resposta).toEqual({ sucesso: true })
      expect(viagemService.criarViagemAvulsaService).toHaveBeenCalledTimes(1)
    })

    it("criarViagemAvulsa recusa dados inválidos e não chama o service", async () => {
      const resposta = await criarViagemAvulsa({} as never)

      expect(resposta.sucesso).toBe(false)
      expect(viagemService.criarViagemAvulsaService).not.toHaveBeenCalled()
    })

    it("criarViagemAvulsa recusa viagem sem produto (produto passou a ser obrigatório)", async () => {
      const { produto, ...semProduto } = viagemValida
      void produto

      const resposta = await criarViagemAvulsa(semProduto as never)

      expect(resposta.sucesso).toBe(false)
      expect(viagemService.criarViagemAvulsaService).not.toHaveBeenCalled()
    })

    it("criarViagemAvulsa recusa data de fim antes do início", async () => {
      const resposta = await criarViagemAvulsa({
        ...viagemValida,
        inicioPrevisto: "2026-08-13T08:00",
        fimPrevisto: "2026-08-12T08:00",
      } as never)

      expect(resposta).toEqual({ sucesso: false, erro: "A data de término não pode ser antes da data de início." })
      expect(viagemService.criarViagemAvulsaService).not.toHaveBeenCalled()
    })

    it("editarViagem segue em frente e chama o service", async () => {
      vi.mocked(viagemService.editarViagemService).mockResolvedValue({} as never)

      const resposta = await editarViagem(1, viagemValida as never)

      expect(resposta).toEqual({ sucesso: true })
      expect(viagemService.editarViagemService).toHaveBeenCalledTimes(1)
    })

    it("editarViagem aceita datas como Date (o fluxo de alocação repassa inicioPrevisto/fimPrevisto já serializados, sem re-string)", async () => {
      vi.mocked(viagemService.editarViagemService).mockResolvedValue({} as never)

      const resposta = await editarViagem(1, {
        ...viagemValida,
        inicioPrevisto: new Date("2026-08-12T08:00:00"),
        fimPrevisto: new Date("2026-08-13T08:00:00"),
        entregas: [{ ...viagemValida.entregas[0], dataEntrega: new Date("2026-08-12T08:00:00") }],
      } as never)

      expect(resposta).toEqual({ sucesso: true })
      expect(viagemService.editarViagemService).toHaveBeenCalledTimes(1)
    })

    it("deletarViagem recusa para usuário DESPACHANTE e não chama o service", async () => {
      const resposta = await deletarViagem(1)

      expect(resposta).toEqual({ sucesso: false, erro: "Não autorizado." })
      expect(viagemService.deletarViagemService).not.toHaveBeenCalled()
    })

    it("atualizarStatusViagem (POSTERGADA) interpreta a nova data como horário de Brasília, não do processo que executa o código", async () => {
      vi.mocked(viagemService.atualizarStatusViagemService).mockResolvedValue({} as never)

      const resposta = await atualizarStatusViagem(1, "POSTERGADA", {
        inicioPrevisto: "2026-08-12T08:00",
        fimPrevisto: "2026-08-13T08:00",
      })

      expect(resposta).toEqual({ sucesso: true })
      const novaData = vi.mocked(viagemService.atualizarStatusViagemService).mock.calls[0][4]
      expect(novaData?.inicioPrevisto.toISOString()).toBe("2026-08-12T11:00:00.000Z")
      expect(novaData?.fimPrevisto.toISOString()).toBe("2026-08-13T11:00:00.000Z")
    })

    it("atualizarSaidaReal interpreta o horário como Brasília, não do processo que executa o código", async () => {
      vi.mocked(viagemService.atualizarSaidaRealService).mockResolvedValue({} as never)

      const resposta = await atualizarSaidaReal(1, { horarioRealSaida: "2026-08-12T08:15", motivoAtraso: null })

      expect(resposta).toEqual({ sucesso: true })
      const horarioRealSaida = vi.mocked(viagemService.atualizarSaidaRealService).mock.calls[0][2]
      expect(horarioRealSaida?.toISOString()).toBe("2026-08-12T11:15:00.000Z")
    })
  })

  describe("com sessão de ADMIN", () => {
    beforeEach(() => {
      vi.mocked(getServerSession).mockResolvedValue({ user: { id: "1", role: "ADMIN" } } as never)
    })

    it("deletarViagem segue em frente e chama o service", async () => {
      vi.mocked(viagemService.deletarViagemService).mockResolvedValue({} as never)

      const resposta = await deletarViagem(1)

      expect(resposta).toEqual({ sucesso: true })
      expect(viagemService.deletarViagemService).toHaveBeenCalledTimes(1)
    })
  })
})
