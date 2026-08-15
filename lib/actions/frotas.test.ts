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

vi.mock("@/lib/services/frota.service", () => ({
  criarFrotaService: vi.fn(),
  editarFrotaService: vi.fn(),
  deletarFrotaService: vi.fn(),
}))

import * as frotaService from "@/lib/services/frota.service"
import { criarFrota, editarFrota, deletarFrota } from "@/lib/actions/frotas"

const frotaValida = { cavalo: "ABC1234", carreta: "XYZ5678", disponivelEm: null, emManutencao: false }

describe("lib/actions/frotas — controle de acesso", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe("sem sessão", () => {
    beforeEach(() => {
      vi.mocked(getServerSession).mockResolvedValue(null)
    })

    it("criarFrota recusa e não chama o service", async () => {
      const resposta = await criarFrota(frotaValida as never)

      expect(resposta.sucesso).toBe(false)
      expect(frotaService.criarFrotaService).not.toHaveBeenCalled()
    })

    it("editarFrota recusa e não chama o service", async () => {
      const resposta = await editarFrota(1, frotaValida as never)

      expect(resposta.sucesso).toBe(false)
      expect(frotaService.editarFrotaService).not.toHaveBeenCalled()
    })

    it("deletarFrota recusa e não chama o service", async () => {
      const resposta = await deletarFrota(1)

      expect(resposta.sucesso).toBe(false)
      expect(frotaService.deletarFrotaService).not.toHaveBeenCalled()
    })
  })

  describe("com sessão", () => {
    beforeEach(() => {
      vi.mocked(getServerSession).mockResolvedValue({ user: { id: "1", role: "DESPACHANTE" } } as never)
    })

    it("criarFrota segue em frente e chama o service", async () => {
      vi.mocked(frotaService.criarFrotaService).mockResolvedValue({} as never)

      const resposta = await criarFrota(frotaValida as never)

      expect(resposta).toEqual({ sucesso: true })
      expect(frotaService.criarFrotaService).toHaveBeenCalledTimes(1)
    })

    it("criarFrota recusa dados inválidos e não chama o service", async () => {
      const resposta = await criarFrota({ cavalo: "", carreta: "", disponivelEm: null } as never)

      expect(resposta.sucesso).toBe(false)
      expect(frotaService.criarFrotaService).not.toHaveBeenCalled()
    })

    it("editarFrota segue em frente e chama o service", async () => {
      vi.mocked(frotaService.editarFrotaService).mockResolvedValue({} as never)

      const resposta = await editarFrota(1, frotaValida as never)

      expect(resposta).toEqual({ sucesso: true })
      expect(frotaService.editarFrotaService).toHaveBeenCalledTimes(1)
    })

    it("deletarFrota recusa para usuário DESPACHANTE e não chama o service", async () => {
      const resposta = await deletarFrota(1)

      expect(resposta).toEqual({ sucesso: false, erro: "Não autorizado." })
      expect(frotaService.deletarFrotaService).not.toHaveBeenCalled()
    })
  })

  describe("com sessão de ADMIN", () => {
    beforeEach(() => {
      vi.mocked(getServerSession).mockResolvedValue({ user: { id: "1", role: "ADMIN" } } as never)
    })

    it("deletarFrota segue em frente e chama o service", async () => {
      vi.mocked(frotaService.deletarFrotaService).mockResolvedValue({} as never)

      const resposta = await deletarFrota(1)

      expect(resposta).toEqual({ sucesso: true })
      expect(frotaService.deletarFrotaService).toHaveBeenCalledTimes(1)
    })
  })
})
