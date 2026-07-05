import { describe, expect, it } from "vitest"
import { formatarStatusViagem } from "@/lib/services/viagem-status.service"

describe("viagem-status.service", () => {
  it("formata os novos status da operação", () => {
    expect(formatarStatusViagem("INICIADA")).toBe("Iniciada")
    expect(formatarStatusViagem("RETORNANDO")).toBe("Retornando")
    expect(formatarStatusViagem("POSTERGADA")).toBe("Postergada")
  })
})
