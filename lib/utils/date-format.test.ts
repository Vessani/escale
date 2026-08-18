import { afterEach, describe, expect, it, vi } from "vitest"
import {
  calcularDiasEntre,
  converterEntradaDeDataHora,
  formatDateForDateInput,
  formatDateTimeForInput,
  formatarDataExcel,
  parseDataHoraBr,
  parseDataLocal,
  parseDateTimeFromInput,
} from "./date-format"

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
  it("conta por horas corridas (48h = 2 dias), não por quantidade de datas de calendário tocadas", () => {
    expect(calcularDiasEntre(new Date("2026-08-01T00:00:00"), new Date("2026-08-03T00:00:00"))).toBe(2)
  })

  it("nunca retorna menos que 1 dia (mesmo início e fim)", () => {
    expect(calcularDiasEntre(new Date("2026-08-05T10:00:00"), new Date("2026-08-05T10:00:00"))).toBe(1)
  })

  it("viagem de 14/08 08:00 a 15/08 19:00 (35h) gasta 2 dias do ciclo do motorista, não 3", () => {
    expect(calcularDiasEntre(new Date("2026-08-14T08:00:00"), new Date("2026-08-15T19:00:00"))).toBe(2)
  })

  it("arredonda pra cima quando sobra fração de dia (25h vira 2 dias)", () => {
    expect(calcularDiasEntre(new Date("2026-08-01T08:00:00"), new Date("2026-08-02T09:00:00"))).toBe(2)
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

describe("parseDateTimeFromInput", () => {
  it("interpreta uma string 'YYYY-MM-DDTHH:MM' como horário de Brasília (UTC-3), retornando o instante UTC certo", () => {
    const data = parseDateTimeFromInput("2026-08-20T08:00")
    expect(data.toISOString()).toBe("2026-08-20T11:00:00.000Z")
  })

  it("aceita segundos opcionais", () => {
    const data = parseDateTimeFromInput("2026-08-20T08:00:30")
    expect(data.toISOString()).toBe("2026-08-20T11:00:30.000Z")
  })

  it("vira o dia (em UTC) corretamente perto da meia-noite de Brasília", () => {
    // 23:30 em Brasília (UTC-3) já é 02:30 do dia seguinte em UTC.
    const data = parseDateTimeFromInput("2026-08-20T23:30")
    expect(data.toISOString()).toBe("2026-08-21T02:30:00.000Z")
  })

  it("rejeita strings que já trazem timezone explícito (Z ou offset) — não é o formato de datetime-local", () => {
    expect(() => parseDateTimeFromInput("2026-08-20T08:00:00.000Z")).toThrow("Data/hora inválida")
    expect(() => parseDateTimeFromInput("2026-08-20T08:00:00-03:00")).toThrow("Data/hora inválida")
  })

  it("rejeita formato fora do padrão", () => {
    expect(() => parseDateTimeFromInput("20/08/2026 08:00")).toThrow("Data/hora inválida")
  })

  it("rejeita data de calendário inexistente (30 de fevereiro)", () => {
    expect(() => parseDateTimeFromInput("2026-02-30T08:00")).toThrow("Data/hora inválida")
  })

  it("rejeita hora fora do intervalo válido (25h)", () => {
    expect(() => parseDateTimeFromInput("2026-08-20T25:00")).toThrow("Data/hora inválida")
  })
})

describe("converterEntradaDeDataHora", () => {
  it("passa direto um Date já construído, sem reajuste", () => {
    const original = new Date("2026-08-20T11:00:00.000Z")
    expect(converterEntradaDeDataHora(original)).toBe(original)
  })

  it("interpreta string sem timezone (formato de datetime-local) como horário de Brasília", () => {
    const data = converterEntradaDeDataHora("2026-08-20T08:00")
    expect(data.toISOString()).toBe("2026-08-20T11:00:00.000Z")
  })

  it("NÃO reajusta uma string que já traz 'Z' — evita corromper um instante já em UTC (ex: vindo de serializeData, usado no fluxo de alocação que não toca nas datas)", () => {
    const data = converterEntradaDeDataHora("2026-08-20T11:00:00.000Z")
    expect(data.toISOString()).toBe("2026-08-20T11:00:00.000Z")
  })

  it("NÃO reajusta uma string com offset explícito", () => {
    const data = converterEntradaDeDataHora("2026-08-20T08:00:00-03:00")
    expect(data.toISOString()).toBe("2026-08-20T11:00:00.000Z")
  })
})

describe("formatDateTimeForInput", () => {
  it('formata um instante UTC como horário de Brasília, no formato de <input type="datetime-local">', () => {
    expect(formatDateTimeForInput(new Date("2026-08-20T11:00:00.000Z"))).toBe("2026-08-20T08:00")
  })

  it("aceita string ISO também", () => {
    expect(formatDateTimeForInput("2026-08-20T11:00:00.000Z")).toBe("2026-08-20T08:00")
  })

  it("é o inverso exato de parseDateTimeFromInput — ida e volta preserva o horário digitado (o bug relatado: 8h virando 5h)", () => {
    const textoOriginal = "2026-08-20T08:00"
    const instante = parseDateTimeFromInput(textoOriginal)
    expect(formatDateTimeForInput(instante)).toBe(textoOriginal)
  })

  it("vira o dia corretamente perto da meia-noite UTC (madrugada em Brasília)", () => {
    // 02:30 UTC é 23:30 do dia anterior em Brasília.
    expect(formatDateTimeForInput(new Date("2026-08-21T02:30:00.000Z"))).toBe("2026-08-20T23:30")
  })
})

describe("formatDateForDateInput", () => {
  it("lê o dia em UTC, sem aplicar nenhum offset (valor vem de coluna @db.Date, sempre meia-noite UTC)", () => {
    expect(formatDateForDateInput(new Date("2026-08-20T00:00:00.000Z"))).toBe("2026-08-20")
  })

  it("não cruza pro dia anterior — o bug que aplicar o offset de Brasília causaria numa meia-noite UTC", () => {
    const meiaNoiteUtc = new Date(Date.UTC(2026, 7, 20, 0, 0, 0))
    expect(formatDateForDateInput(meiaNoiteUtc)).toBe("2026-08-20")
  })
})
