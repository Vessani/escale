import { describe, expect, it } from "vitest"
import {
  ehStatusViagem,
  formatarStatusViagem,
  normalizarStatusViagem,
  STATUS_VIAGEM_OPCOES,
  STATUS_VIAGEM_VALORES,
} from "@/lib/services/viagem-status.service"

describe("viagem-status.service", () => {
  it("formata todos os status conhecidos em português", () => {
    expect(formatarStatusViagem("CRIADA")).toBe("Criada")
    expect(formatarStatusViagem("ALOCADA")).toBe("Alocada")
    expect(formatarStatusViagem("INICIADA")).toBe("Iniciada")
    expect(formatarStatusViagem("RETORNANDO")).toBe("Retornando")
    expect(formatarStatusViagem("POSTERGADA")).toBe("Postergada")
    expect(formatarStatusViagem("FINALIZADA")).toBe("Finalizada")
    expect(formatarStatusViagem("CANCELADA")).toBe("Cancelada")
  })

  it("normaliza um status do Prisma repassando o mesmo valor", () => {
    expect(normalizarStatusViagem("INICIADA")).toBe("INICIADA")
  })

  it("reconhece valores válidos de status", () => {
    for (const valor of STATUS_VIAGEM_VALORES) {
      expect(ehStatusViagem(valor)).toBe(true)
    }
  })

  it("rejeita valores que não são status de viagem", () => {
    expect(ehStatusViagem("EM_TRANSITO")).toBe(false)
    expect(ehStatusViagem("")).toBe(false)
    expect(ehStatusViagem("criada")).toBe(false) // case-sensitive
  })

  it("gera uma opção de select para cada status, com o mesmo label de formatarStatusViagem", () => {
    expect(STATUS_VIAGEM_OPCOES).toHaveLength(STATUS_VIAGEM_VALORES.length)

    for (const opcao of STATUS_VIAGEM_OPCOES) {
      expect(opcao.label).toBe(formatarStatusViagem(opcao.valor))
    }
  })
})
