import { describe, expect, it } from "vitest"
import * as XLSX from "xlsx"
import {
  sanitizarNomeArquivo,
  gerarExcelViagem,
  gerarExcelRelatorioGeral,
  gerarExcelViagensMotorista,
  gerarExcelViagensCriadasHoje,
} from "@/lib/services/excel-export.service"

function lerPrimeiraAba(buffer: Buffer) {
  const workbook = XLSX.read(buffer, { type: "buffer" })
  const nomeAba = workbook.SheetNames[0]
  return { nomeAba, linhas: XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets[nomeAba]) }
}

describe("sanitizarNomeArquivo", () => {
  it("troca caracteres inválidos de nome de arquivo por hífen", () => {
    expect(sanitizarNomeArquivo('viagem/123:teste?"<>|')).toBe("viagem-123-teste-----")
  })

  it("mantém nomes já válidos intactos", () => {
    expect(sanitizarNomeArquivo("viagem-123")).toBe("viagem-123")
  })
})

const viagemBase = {
  numViagem: "123",
  status: "ALOCADA",
  turno: "MANHA",
  produto: "CO2" as const,
  inicioPrevisto: new Date("2026-08-12T08:00:00Z"),
  fimPrevisto: new Date("2026-08-13T08:00:00Z"),
  diasViagem: 1,
  cavalo: "ABC1234",
  carreta: "XYZ5678",
  tanque: "TANQUE1",
  motorista: { nome: "João da Silva", cpf: "11144477735" },
  motoristaAcompanhante: null,
  integracaoExigida: null,
  entregas: [
    {
      dataEntrega: new Date("2026-08-12T10:00:00Z"),
      cliente: "Cliente Teste",
      cidade: "Cidade Teste",
      uf: "SC",
      kg: 100,
      m3: 10,
      sapcode: "SAP1",
      codewhite: "CW1",
      obs: "Observação",
    },
  ],
}

describe("gerarExcelViagem", () => {
  it("gera workbook com abas Viagem e Entregas, com os dados da viagem", () => {
    const buffer = gerarExcelViagem(viagemBase)
    const workbook = XLSX.read(buffer, { type: "buffer" })

    expect(workbook.SheetNames).toEqual(["Viagem", "Entregas"])

    const linhasViagem = XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets["Viagem"])
    expect(linhasViagem).toHaveLength(1)
    expect(linhasViagem[0]["Nº Viagem"]).toBe("123")
    expect(linhasViagem[0]["Produto"]).toBe("CO2")
    expect(linhasViagem[0]["Motorista"]).toBe("João da Silva")

    const linhasEntregas = XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets["Entregas"])
    expect(linhasEntregas).toHaveLength(1)
    expect(linhasEntregas[0]["Cliente"]).toBe("Cliente Teste")
    expect(linhasEntregas[0]["Peso (kg)"]).toBe(100)
  })

  it("mostra Não alocado quando não há motorista, e uma linha de placeholder sem entregas", () => {
    const buffer = gerarExcelViagem({ ...viagemBase, motorista: null, entregas: [] })
    const workbook = XLSX.read(buffer, { type: "buffer" })

    const linhasViagem = XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets["Viagem"])
    expect(linhasViagem[0]["Motorista"]).toBe("Não alocado")

    const linhasEntregas = XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets["Entregas"])
    expect(linhasEntregas).toHaveLength(1)
    expect(linhasEntregas[0]["Cliente"]).toBe("Nenhuma entrega cadastrada")
  })

  it("mostra Não informado quando a viagem não tem produto definido", () => {
    const buffer = gerarExcelViagem({ ...viagemBase, produto: null })
    const workbook = XLSX.read(buffer, { type: "buffer" })
    const linhasViagem = XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets["Viagem"])
    expect(linhasViagem[0]["Produto"]).toBe("Não informado")
  })
})

const relatorioBase = {
  numViagem: "456",
  status: "INICIADA",
  turno: "TARDE",
  produto: "NITROGENIO" as const,
  inicioPrevisto: new Date("2026-08-12T08:00:00Z"),
  fimPrevisto: new Date("2026-08-13T08:00:00Z"),
  cavalo: "AAA1111",
  carreta: "BBB2222",
  tanque: "TANQUE2",
  motorista: { nome: "Maria Souza", cpf: "52998224725" },
  motoristaAcompanhante: null,
  integracaoExigida: "Cliente X",
}

describe("gerarExcelRelatorioGeral", () => {
  it("gera uma aba Viagens com uma linha por viagem, colunas de motorista/frota cruzadas", () => {
    const buffer = gerarExcelRelatorioGeral([relatorioBase])
    const { nomeAba, linhas } = lerPrimeiraAba(buffer)

    expect(nomeAba).toBe("Viagens")
    expect(linhas).toHaveLength(1)
    expect(linhas[0]["Nº Viagem"]).toBe("456")
    expect(linhas[0]["Produto"]).toBe("Nitrogênio")
    expect(linhas[0]["CPF Motorista"]).toBe("52998224725")
    expect(linhas[0]["Cavalo"]).toBe("AAA1111")
    expect(linhas[0]["Integração Exigida"]).toBe("Cliente X")
  })
})

describe("gerarExcelViagensMotorista", () => {
  it("gera uma aba Viagens com as viagens do motorista informado", () => {
    const buffer = gerarExcelViagensMotorista([relatorioBase])
    const { nomeAba, linhas } = lerPrimeiraAba(buffer)

    expect(nomeAba).toBe("Viagens")
    expect(linhas).toHaveLength(1)
    expect(linhas[0]["Motorista"]).toBe("Maria Souza")
  })
})

describe("gerarExcelViagensCriadasHoje", () => {
  it("gera uma aba Viagens com as viagens criadas no dia", () => {
    const buffer = gerarExcelViagensCriadasHoje([relatorioBase])
    const { nomeAba, linhas } = lerPrimeiraAba(buffer)

    expect(nomeAba).toBe("Viagens")
    expect(linhas).toHaveLength(1)
    expect(linhas[0]["Status"]).toBe("INICIADA")
  })
})
