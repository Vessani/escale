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

vi.mock("@/lib/services/motorista.service", () => ({
  criarMotoristaService: vi.fn(),
  editarMotoristaService: vi.fn(),
  deletarMotoristaService: vi.fn(),
  registrarJornadaNoDiaService: vi.fn(),
}))

import * as motoristaService from "@/lib/services/motorista.service"
import {
  criarMotorista,
  editarMotorista,
  deletarMotorista,
  atualizarJornadaMotoristaNoCalendario,
} from "@/lib/actions/motoristas"

describe("lib/actions/motoristas — controle de acesso", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe("sem sessão", () => {
    beforeEach(() => {
      vi.mocked(getServerSession).mockResolvedValue(null)
    })

    it("criarMotorista recusa e não chama o service", async () => {
      const resposta = await criarMotorista({} as never)

      expect(resposta.sucesso).toBe(false)
      expect(motoristaService.criarMotoristaService).not.toHaveBeenCalled()
    })

    it("editarMotorista recusa e não chama o service", async () => {
      const resposta = await editarMotorista(1, {} as never)

      expect(resposta.sucesso).toBe(false)
      expect(motoristaService.editarMotoristaService).not.toHaveBeenCalled()
    })

    it("deletarMotorista recusa e não chama o service", async () => {
      const resposta = await deletarMotorista(1)

      expect(resposta.sucesso).toBe(false)
      expect(motoristaService.deletarMotoristaService).not.toHaveBeenCalled()
    })

    it("atualizarJornadaMotoristaNoCalendario recusa e não chama o service", async () => {
      const resposta = await atualizarJornadaMotoristaNoCalendario(1, "2026-07-08", 3)

      expect(resposta.sucesso).toBe(false)
      expect(motoristaService.registrarJornadaNoDiaService).not.toHaveBeenCalled()
    })
  })

  describe("com sessão", () => {
    beforeEach(() => {
      vi.mocked(getServerSession).mockResolvedValue({ user: { id: "1" } } as never)
    })

    it("criarMotorista segue em frente e chama o service", async () => {
      vi.mocked(motoristaService.criarMotoristaService).mockResolvedValue({} as never)

      const resposta = await criarMotorista({} as never)

      expect(resposta).toEqual({ sucesso: true })
      expect(motoristaService.criarMotoristaService).toHaveBeenCalledTimes(1)
    })

    it("atualizarJornadaMotoristaNoCalendario segue em frente e chama o service", async () => {
      vi.mocked(motoristaService.registrarJornadaNoDiaService).mockResolvedValue({} as never)

      const resposta = await atualizarJornadaMotoristaNoCalendario(1, "2026-07-08", 3)

      expect(resposta).toEqual({ sucesso: true })
      expect(motoristaService.registrarJornadaNoDiaService).toHaveBeenCalledTimes(1)
    })
  })
})
