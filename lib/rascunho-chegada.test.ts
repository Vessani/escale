import { describe, expect, it } from "vitest"
import {
  VALIDADE_RASCUNHO_HORAS,
  apagarRascunho,
  chaveDoRascunho,
  lerRascunho,
  rascunhoTemConteudo,
  salvarRascunho,
  type CamposRascunho,
} from "./rascunho-chegada"

function armazenamentoFalso() {
  const dados = new Map<string, string>()
  return {
    dados,
    getItem: (k: string) => dados.get(k) ?? null,
    setItem: (k: string, v: string) => void dados.set(k, v),
    removeItem: (k: string) => void dados.delete(k),
  }
}

const vazio: CamposRascunho = {
  km: "",
  quando: "2026-10-29T14:00",
  medicao: null,
  fator: "",
  polInicial: "",
  polFinal: "",
  m3Inicial: "",
  m3Final: "",
  kgInicial: "",
  kgFinal: "",
  pctInicial: "",
  pctFinal: "",
  inicial: "",
  final: "",
}
const preenchido: CamposRascunho = { ...vazio, km: "100010", medicao: "BALANCA", kgInicial: "5000", kgFinal: "4000" }
const entrega = { id: 11, cliente: "WEG", cidade: "JARAGUA DO SUL", uf: "SC" }
const chave = chaveDoRascunho("m7-v3", 11)
const agora = Date.UTC(2026, 9, 29, 17, 0)

describe("rascunho da chegada no celular", () => {
  it("a chave separa motorista, viagem e entrega", () => {
    expect(chaveDoRascunho("m7-v3", 11)).not.toBe(chaveDoRascunho("m8-v3", 11))
    expect(chaveDoRascunho("m7-v3", 11)).not.toBe(chaveDoRascunho("m7-v3", 12))
  })

  it("guarda o que foi digitado e devolve ao reabrir", () => {
    const a = armazenamentoFalso()
    salvarRascunho(chave, entrega, preenchido, { agora, armazenamento: a })
    expect(lerRascunho(chave, entrega, { agora: agora + 60_000, armazenamento: a })?.campos).toEqual(preenchido)
  })

  it("só a data e hora padrão não é rascunho (e apaga o que havia)", () => {
    expect(rascunhoTemConteudo(vazio)).toBe(false)
    expect(rascunhoTemConteudo({ ...vazio, medicao: "MANOMETRO" })).toBe(true)
    const a = armazenamentoFalso()
    salvarRascunho(chave, entrega, preenchido, { agora, armazenamento: a })
    salvarRascunho(chave, entrega, vazio, { agora, armazenamento: a })
    expect(a.dados.size).toBe(0)
  })

  it("vence depois de 24h", () => {
    const a = armazenamentoFalso()
    salvarRascunho(chave, entrega, preenchido, { agora, armazenamento: a })
    const depois = agora + VALIDADE_RASCUNHO_HORAS * 60 * 60 * 1000 + 1
    expect(lerRascunho(chave, entrega, { agora: depois, armazenamento: a })).toBeNull()
    expect(a.dados.size).toBe(0)
  })

  it("entrega que mudou de cliente desde o rascunho: descarta (a medição foi no cliente de antes)", () => {
    const a = armazenamentoFalso()
    salvarRascunho(chave, entrega, preenchido, { agora, armazenamento: a })
    expect(lerRascunho(chave, { ...entrega, cliente: "TUPY" }, { agora, armazenamento: a })).toBeNull()
    expect(a.dados.size).toBe(0)
  })

  it("conteúdo estragado ou de outra versão: descarta sem quebrar a tela", () => {
    const a = armazenamentoFalso()
    a.setItem(chave, "{nao é json")
    expect(lerRascunho(chave, entrega, { agora, armazenamento: a })).toBeNull()
    a.setItem(chave, JSON.stringify({ versao: 99, salvoEm: agora, vista: entrega, campos: preenchido }))
    expect(lerRascunho(chave, entrega, { agora, armazenamento: a })).toBeNull()
  })

  it("sem armazenamento (aba anônima, bloqueado) ou armazenamento que lança: segue sem rascunho", () => {
    expect(() => salvarRascunho(chave, entrega, preenchido, { agora, armazenamento: null })).not.toThrow()
    expect(lerRascunho(chave, entrega, { agora, armazenamento: null })).toBeNull()
    const quebrado = {
      getItem: () => {
        throw new Error("SecurityError")
      },
      setItem: () => {
        throw new Error("QuotaExceeded")
      },
      removeItem: () => {
        throw new Error("SecurityError")
      },
    }
    expect(() => salvarRascunho(chave, entrega, preenchido, { agora, armazenamento: quebrado })).not.toThrow()
    expect(lerRascunho(chave, entrega, { agora, armazenamento: quebrado })).toBeNull()
    expect(() => apagarRascunho(chave, quebrado)).not.toThrow()
  })
})
