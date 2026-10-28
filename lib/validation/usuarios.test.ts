import { describe, expect, it } from "vitest"
import { usuarioSchema } from "@/lib/validation/usuarios"

const base = { nome: "Central", email: "torre@empresa.com", senha: "senha-forte-123" }

describe("usuarioSchema", () => {
  it("torre e superadmin não precisam de filial", () => {
    expect(usuarioSchema.safeParse({ ...base, role: "TORRE", filialId: null }).success).toBe(true)
    expect(usuarioSchema.safeParse({ ...base, role: "SUPERADMIN", filialId: null }).success).toBe(true)
  })

  it("admin e despachante continuam exigindo filial", () => {
    for (const role of ["ADMIN", "DESPACHANTE"]) {
      expect(usuarioSchema.safeParse({ ...base, role, filialId: null }).success).toBe(false)
      expect(usuarioSchema.safeParse({ ...base, role, filialId: 2 }).success).toBe(true)
    }
  })

  it("motorista não é criado por aqui (tem acesso próprio, SEVA + PIN)", () => {
    expect(usuarioSchema.safeParse({ ...base, role: "MOTORISTA", filialId: 2 }).success).toBe(false)
  })
})
