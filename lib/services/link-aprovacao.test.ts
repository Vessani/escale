import { describe, expect, it } from "vitest"
import { enderecoDoSistema, expiracaoDoLink, gerarTokenLink, hashDoToken, semToken, urlDeAprovacao } from "./link-aprovacao"
import { montarLinkWhatsApp, situacaoDoPedido } from "./link-aprovacao-regras"

describe("token do link", () => {
  it("é aleatório, de 43 caracteres base64url, e só o hash SHA-256 vai pro banco", () => {
    const a = gerarTokenLink()
    const b = gerarTokenLink()
    expect(a.token).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expect(a.token).not.toBe(b.token)
    expect(a.tokenHash).toBe(hashDoToken(a.token))
    expect(a.tokenHash).toMatch(/^[0-9a-f]{64}$/)
    expect(a.tokenHash).not.toContain(a.token)
  })

  it("monta a URL pública de cada tipo de pedido a partir do NEXTAUTH_URL, sem barra dupla", () => {
    expect(urlDeAprovacao("/aprovar-estouro", "abc", "https://escalador.test/")).toBe("https://escalador.test/aprovar-estouro/abc")
    expect(urlDeAprovacao("/aprovar-uber", "abc", "https://escalador.test")).toBe("https://escalador.test/aprovar-uber/abc")
    expect(() => urlDeAprovacao("/aprovar-uber", "abc", "")).toThrow("NEXTAUTH_URL")
  })

  it("sem NEXTAUTH_URL, usa o domínio de produção da Vercel", () => {
    expect(enderecoDoSistema({ NEXTAUTH_URL: "https://a.test", VERCEL_PROJECT_PRODUCTION_URL: "b.test" })).toBe("https://a.test")
    expect(enderecoDoSistema({ VERCEL_PROJECT_PRODUCTION_URL: "escale-sepia.vercel.app" })).toBe("https://escale-sepia.vercel.app")
    expect(enderecoDoSistema({})).toBeUndefined()
  })

  it("vale 12h", () => {
    expect(expiracaoDoLink(new Date("2026-10-27T12:00:00Z"))).toEqual(new Date("2026-10-28T00:00:00Z"))
  })

  it("a auditoria não leva o hash", () => {
    expect(semToken({ id: 1, tokenHash: "x", status: "PENDENTE" })).toEqual({ id: 1, status: "PENDENTE" })
  })
})

describe("situacaoDoPedido", () => {
  const agora = new Date("2026-10-27T12:00:00Z")

  it("pendente com link vencido aparece como expirado", () => {
    expect(situacaoDoPedido({ status: "PENDENTE", expiraEm: new Date("2026-10-27T11:59:59Z") }, agora)).toBe("EXPIRADO")
    expect(situacaoDoPedido({ status: "PENDENTE", expiraEm: new Date("2026-10-27T12:00:01Z") }, agora)).toBe("PENDENTE")
  })

  it("decidido continua decidido mesmo depois da validade", () => {
    expect(situacaoDoPedido({ status: "APROVADO", expiraEm: new Date("2026-10-26T00:00:00Z") }, agora)).toBe("APROVADO")
  })
})

describe("montarLinkWhatsApp", () => {
  it("link de compartilhar sem número (a pessoa escolhe o grupo), com o texto inteiro", () => {
    const link = montarLinkWhatsApp("*Pedido*\nLinha 2 & mais")
    expect(link.startsWith("https://wa.me/?text=")).toBe(true)
    expect(decodeURIComponent(link.split("?text=")[1])).toBe("*Pedido*\nLinha 2 & mais")
  })
})
