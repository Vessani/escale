import { afterEach, describe, expect, it, vi } from "vitest"
import { calcularDiasEntre, formatarDataExcel, parseDataHoraBr, parseDataLocal } from "./date-format"

describe("formatarDataExcel", () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it("interpreta DD.MM com o ano corrente quando o resultado fica próximo de hoje", () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-07-15T12:00:00"))

    expect(formatarDataExcel("20.07", "08:00")).toBe("2026-07-20T08:00")
  })

  it("interpreta DD.MM do ano anterior quando o resultado cai mais de 60 dias no futuro (virada de ano)", () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2027-01-05T12:00:00"))

    // "30.12" sem ano, montado com o ano corrente (2027), cairia quase 12
    // meses no futuro — deve assumir que é do ano anterior (2026).
    expect(formatarDataExcel("30.12", "08:00")).toBe("2026-12-30T08:00")
  })

  it("interpreta DD.MM.YYYY com o ano explícito da planilha", () => {
    expect(formatarDataExcel("05.03.2026", "10:30")).toBe("2026-03-05T10:30")
  })

  it("interpreta o formato '.' do SAP (ponto final sobrando)", () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-07-01T12:00:00"))

    expect(formatarDataExcel("04.07.", "09:00")).toBe("2026-07-04T09:00")
  })

  it("retorna string vazia para entrada vazia ou inválida", () => {
    expect(formatarDataExcel("")).toBe("")
    expect(formatarDataExcel("não é data")).toBe("")
  })
})

describe("calcularDiasEntre", () => {
  it("conta o intervalo inclusivo do primeiro ao último dia", () => {
    expect(calcularDiasEntre(new Date("2026-08-01T00:00:00"), new Date("2026-08-03T00:00:00"))).toBe(3)
  })

  it("nunca retorna menos que 1 dia (mesmo início e fim)", () => {
    expect(calcularDiasEntre(new Date("2026-08-05T10:00:00"), new Date("2026-08-05T10:00:00"))).toBe(1)
  })
})

describe("parseDataLocal", () => {
  it("aceita uma data YYYY-MM-DD válida", () => {
    const data = parseDataLocal("2026-02-28")
    expect(data.getFullYear()).toBe(2026)
    expect(data.getMonth()).toBe(1)
    expect(data.getDate()).toBe(28)
  })

  it("rejeita uma data calendário inexistente (29/02 em ano não bissexto)", () => {
    expect(() => parseDataLocal("2026-02-29")).toThrow("Data inválida.")
  })

  it("rejeita formato fora do padrão YYYY-MM-DD", () => {
    expect(() => parseDataLocal("28/02/2026")).toThrow("Data inválida.")
  })
})

describe("parseDataHoraBr", () => {
  it("aceita 'DD/MM/YYYY HH:MM' sem segundos", () => {
    const data = parseDataHoraBr("10/07/2026 04:10")
    expect(data.getHours()).toBe(4)
    expect(data.getMinutes()).toBe(10)
  })

  it("aceita segundos opcionais", () => {
    const data = parseDataHoraBr("10/07/2026 04:10:45")
    expect(data.getSeconds()).toBe(45)
  })

  it("rejeita texto fora do formato esperado", () => {
    expect(() => parseDataHoraBr("2026-07-10 04:10")).toThrow("Data/hora inválida.")
  })
})
