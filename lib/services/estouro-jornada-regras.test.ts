import { describe, expect, it } from "vitest"
import {
  LIMITE_MINUTOS_ESTOURO,
  OPCOES_MINUTOS_ESTOURO,
  formatarMinutos,
  formatarMotivos,
  montarLinkWhatsApp,
  montarMensagemWhatsApp,
  situacaoDoEstouro,
} from "./estouro-jornada-regras"

describe("formatarMinutos", () => {
  it("mostra horas e minutos do jeito que a operação fala", () => {
    expect(formatarMinutos(30)).toBe("30min")
    expect(formatarMinutos(60)).toBe("1h")
    expect(formatarMinutos(150)).toBe("2h30")
    expect(formatarMinutos(240)).toBe("4h")
  })
})

describe("OPCOES_MINUTOS_ESTOURO", () => {
  it("vai de 30 em 30 minutos até o teto de 2h", () => {
    expect(LIMITE_MINUTOS_ESTOURO).toBe(120)
    expect(OPCOES_MINUTOS_ESTOURO).toEqual([30, 60, 90, 120])
  })
})

describe("formatarMotivos", () => {
  it("junta os rótulos na ordem da lista, não na ordem do clique", () => {
    expect(formatarMotivos(["ABASTECER", "CLIENTE_PRIORITARIO"])).toBe("Cliente prioritário, Abastecer")
    expect(formatarMotivos(["CHEGAR_HOTEL"])).toBe("Chegar no hotel")
    expect(formatarMotivos(["ABASTECER", "CHEGAR_CDL"])).toBe("Chegar ao CDL, Abastecer")
  })
})

describe("situacaoDoEstouro", () => {
  const agora = new Date("2026-10-27T12:00:00Z")

  it("pendente com link vencido aparece como expirado", () => {
    expect(situacaoDoEstouro({ status: "PENDENTE", expiraEm: new Date("2026-10-27T11:59:59Z") }, agora)).toBe("EXPIRADO")
    expect(situacaoDoEstouro({ status: "PENDENTE", expiraEm: new Date("2026-10-27T12:00:01Z") }, agora)).toBe("PENDENTE")
  })

  it("decidido continua decidido mesmo depois da validade", () => {
    expect(situacaoDoEstouro({ status: "APROVADO", expiraEm: new Date("2026-10-26T00:00:00Z") }, agora)).toBe("APROVADO")
  })
})

describe("mensagem e link do WhatsApp", () => {
  it("monta o texto com a viagem quando tem, e o link de compartilhar (sem número: a pessoa escolhe o grupo)", () => {
    const mensagem = montarMensagemWhatsApp({
      motorista: "JOÃO DA SILVA",
      numViagem: "123456",
      minutosExtras: 90,
      motivos: ["TRANSITO_LENTO", "CHEGAR_CLIENTE"],
      solicitante: "Alan",
      url: "https://escalador.app/aprovar-estouro/abc",
    })
    expect(mensagem).toContain("Viagem: 123456")
    expect(mensagem).toContain("Horas extras: 1h30")
    expect(mensagem).toContain("Motivo: Trânsito lento, Chegar no cliente")
    expect(mensagem.endsWith("Gestor, aprove ou recuse: https://escalador.app/aprovar-estouro/abc")).toBe(true)

    const link = montarLinkWhatsApp(mensagem)
    expect(link.startsWith("https://wa.me/?text=")).toBe(true)
    expect(decodeURIComponent(link.split("?text=")[1])).toBe(mensagem)
  })

  it("sem viagem, não põe a linha da viagem", () => {
    const mensagem = montarMensagemWhatsApp({
      motorista: "X",
      numViagem: null,
      minutosExtras: 30,
      motivos: ["ABASTECER"],
      solicitante: null,
      url: "u",
    })
    expect(mensagem).not.toContain("Viagem:")
    expect(mensagem).not.toContain("Pedido por:")
  })
})
