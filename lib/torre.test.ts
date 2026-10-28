import { describe, expect, it, vi, beforeEach } from "vitest"

const cookiesDoNavegador = new Map<string, string>()

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    get: (nome: string) => (cookiesDoNavegador.has(nome) ? { value: cookiesDoNavegador.get(nome) } : undefined),
    set: vi.fn(),
  })),
}))

vi.mock("@/lib/prisma", () => ({
  prisma: {
    filial: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
    },
  },
}))

import { prisma } from "@/lib/prisma"
import { COOKIE_FILIAL_TORRE, filialDaTorre, lerIdDoCookie } from "@/lib/torre"

describe("lerIdDoCookie", () => {
  it("aceita só inteiro positivo", () => {
    expect(lerIdDoCookie("12")).toBe(12)
    for (const valor of [undefined, "", "0", "-3", "1.5", "abc", "12abc", "99999999999999999999"]) expect(lerIdDoCookie(valor)).toBeNull()
  })
})

describe("filialDaTorre", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    cookiesDoNavegador.clear()
  })

  it("usa a filial escolhida quando ela existe", async () => {
    cookiesDoNavegador.set(COOKIE_FILIAL_TORRE, "4")
    vi.mocked(prisma.filial.findUnique).mockResolvedValue({ id: 4 } as never)

    await expect(filialDaTorre()).resolves.toBe(4)
    expect(prisma.filial.findFirst).not.toHaveBeenCalled()
  })

  it("filial escolhida que não existe mais (ou primeiro acesso) cai na primeira em ordem alfabética", async () => {
    cookiesDoNavegador.set(COOKIE_FILIAL_TORRE, "4")
    vi.mocked(prisma.filial.findUnique).mockResolvedValue(null)
    vi.mocked(prisma.filial.findFirst).mockResolvedValue({ id: 2 } as never)
    await expect(filialDaTorre()).resolves.toBe(2)

    cookiesDoNavegador.clear()
    await expect(filialDaTorre()).resolves.toBe(2)
    expect(prisma.filial.findFirst).toHaveBeenCalledWith({ orderBy: { nome: "asc" }, select: { id: true } })
  })

  it("null quando não há nenhuma filial cadastrada", async () => {
    vi.mocked(prisma.filial.findFirst).mockResolvedValue(null)

    await expect(filialDaTorre()).resolves.toBeNull()
  })
})
