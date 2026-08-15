import { describe, expect, it } from "vitest"
import { formatarDetalheMotoristaCompativel, formatarOpcaoMotoristaCompativel, rotularMotoristaParaSelect } from "./motorista-format"
import type { MotoristaCompativel } from "@/lib/types/alocacao"

function criarMotorista(parcial: Partial<MotoristaCompativel> = {}): MotoristaCompativel {
  return {
    id: 1,
    nome: "JOSE ROCHA",
    diasTrabalhados: 1,
    diasDisponiveis: 5,
    turno: "MANHA",
    horarioHabitual: null,
    proximoInicioDisponivel: null,
    ...parcial,
  }
}

describe("formatarOpcaoMotoristaCompativel", () => {
  it("mostra proximoInicioDisponivel (o que decide a ordem de sugestão), não horarioHabitual", () => {
    const motorista = criarMotorista({ horarioHabitual: "10:28", proximoInicioDisponivel: "06:00" })

    const texto = formatarOpcaoMotoristaCompativel(motorista)

    expect(texto).toBe("JOSE ROCHA · 5 dias disponíveis · livre a partir de 06:00")
    expect(texto).not.toContain("10:28")
  })

  it("omite o horário quando proximoInicioDisponivel é null (sem jornada importada)", () => {
    const motorista = criarMotorista({ horarioHabitual: "10:28", proximoInicioDisponivel: null })

    const texto = formatarOpcaoMotoristaCompativel(motorista)

    expect(texto).toBe("JOSE ROCHA · 5 dias disponíveis")
  })

  it("usa singular pra 1 dia disponível", () => {
    const motorista = criarMotorista({ diasDisponiveis: 1, proximoInicioDisponivel: null })

    const texto = formatarOpcaoMotoristaCompativel(motorista)

    expect(texto).toBe("JOSE ROCHA · 1 dia disponível")
  })
})

describe("formatarDetalheMotoristaCompativel", () => {
  it("mostra dias disponíveis e livre a partir, sem o nome — pra usar onde o nome já apareceu em outro lugar", () => {
    const motorista = criarMotorista({ diasDisponiveis: 1, proximoInicioDisponivel: "03:32" })

    const texto = formatarDetalheMotoristaCompativel(motorista)

    expect(texto).toBe("1 dia disponível · livre a partir de 03:32")
    expect(texto).not.toContain("JOSE ROCHA")
  })

  it("é exatamente o que sobra de formatarOpcaoMotoristaCompativel ao tirar o nome", () => {
    const motorista = criarMotorista({ diasDisponiveis: 3, proximoInicioDisponivel: "14:00" })

    expect(formatarOpcaoMotoristaCompativel(motorista)).toBe(`${motorista.nome} · ${formatarDetalheMotoristaCompativel(motorista)}`)
  })
})

describe("rotularMotoristaParaSelect", () => {
  it("compatível e disponível", () => {
    expect(rotularMotoristaParaSelect(true, true)).toBe("(Compatível)")
  })

  it("incompatível mas disponível", () => {
    expect(rotularMotoristaParaSelect(false, true)).toBe("(Emergência)")
  })

  it("compatível mas indisponível", () => {
    expect(rotularMotoristaParaSelect(true, false)).toBe("(Sem descanso / já em viagem)")
  })

  it("incompatível e indisponível", () => {
    expect(rotularMotoristaParaSelect(false, false)).toBe("(Emergência + sem descanso)")
  })
})
