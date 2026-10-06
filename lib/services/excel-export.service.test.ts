import { describe, expect, it } from "vitest"
import ExcelJS from "exceljs"
import { sanitizarNomeArquivo, gerarExcelViagem } from "@/lib/services/excel-export.service"
import { excelProgramacaoDoDia } from "@/lib/excel/viagens"
import { lerAba, nomesDasAbas, textoDaAba } from "@/lib/excel/ler-planilha"

describe("sanitizarNomeArquivo", () => {
  it("troca caracteres inválidos de nome de arquivo por hífen", () => {
    expect(sanitizarNomeArquivo('viagem/123:teste?"<>|')).toBe("viagem-123-teste-----")
  })

  it("mantém nomes já válidos intactos", () => {
    expect(sanitizarNomeArquivo("viagem-123")).toBe("viagem-123")
  })
})

const entrega = {
  dataEntrega: new Date("2026-08-12T13:00:00Z"),
  cliente: "CLIENTE TESTE",
  cidade: "JOINVILLE",
  uf: "SC",
  kg: 100,
  m3: 10,
  sapcode: "SAP1",
  codewhite: "CW1",
  obs: "Observação",
}

const viagemBase = {
  numViagem: "123",
  status: "ALOCADA" as const,
  turno: "MANHA",
  produto: "CO2" as const,
  inicioPrevisto: new Date("2026-08-12T11:00:00Z"),
  fimPrevisto: new Date("2026-08-13T08:00:00Z"),
  diasViagem: 1,
  cavalo: "ABC1234",
  carreta: "XYZ5678",
  tanque: "TANQUE1",
  motorista: { nome: "JOÃO DA SILVA", cpf: "11144477735" },
  motoristaAcompanhante: null,
  integracaoExigida: null,
  viagemExtra: false,
  entregas: [entrega, { ...entrega, cidade: "BLUMENAU", kg: 50, sapcode: "SAP2" }],
}

describe("gerarExcelViagem (ordem de viagem)", () => {
  it("uma aba com equipe, frota, horários, entregas com total e espaço pra assinatura", async () => {
    const buffer = await gerarExcelViagem(viagemBase, { filial: "Joinville" })

    expect(nomesDasAbas(buffer)).toEqual(["Ordem de viagem"])
    const texto = textoDaAba(buffer, "Ordem de viagem")
    expect(texto).toContain("Ordem de viagem · Nº 123")
    expect(texto).toContain("João da Silva")
    expect(texto).toContain("Carbono")
    expect(texto).toContain("Filial Joinville")
    expect(texto).toContain("Joinville › Blumenau")
    expect(texto).toContain("Entregas (2)")
    expect(texto).toContain("150")
    expect(texto).toContain("Assinatura do motorista")
  })

  it("grava data de verdade, no horário de Brasília", async () => {
    const buffer = await gerarExcelViagem(viagemBase)
    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.load(buffer as unknown as ArrayBuffer)
    const datas: Date[] = []
    workbook.getWorksheet("Ordem de viagem")!.eachRow((linha) =>
      linha.eachCell((celula) => {
        if (celula.value instanceof Date) datas.push(celula.value)
      }),
    )
    // 11:00Z = 08:00 em Brasília; o Excel não tem fuso, então a célula guarda 08:00.
    expect(datas[0].toISOString()).toBe("2026-08-12T08:00:00.000Z")
  })

  it("sem motorista e sem entrega", async () => {
    const texto = textoDaAba(await gerarExcelViagem({ ...viagemBase, motorista: null, entregas: [] }), "Ordem de viagem")
    expect(texto).toContain("Não alocado")
    expect(texto).toContain("Nenhuma entrega cadastrada.")
  })
})

describe("excelProgramacaoDoDia", () => {
  it("separa por turno, mostra motorista/frota e lista as entregas por viagem", async () => {
    const buffer = await excelProgramacaoDoDia({
      dia: new Date("2026-08-12T15:00:00Z"),
      viagens: [
        { ...viagemBase, numViagem: "N1", turno: "NOITE", inicioPrevisto: new Date("2026-08-12T22:00:00Z") },
        { ...viagemBase, numViagem: "D1" },
        { ...viagemBase, numViagem: "D2", motorista: null, entregas: [] },
        { ...viagemBase, numViagem: "X1", status: "CANCELADA" as const },
      ],
    })

    expect(nomesDasAbas(buffer)).toEqual(["Programação", "Entregas"])
    const texto = textoDaAba(buffer, "Programação")
    expect(texto).toContain("Programação de viagens · quarta-feira, 12/08/2026")
    expect(texto).toMatch(/Turno dia[\s\S]*D1[\s\S]*D2[\s\S]*X1[\s\S]*Turno noite[\s\S]*N1/)
    expect(texto).toContain("Sem motorista: 1")
    expect(texto).toContain("Canceladas: 1")

    const linhas = lerAba(buffer, "Programação")
    const d1 = linhas.find((linha) => linha["Nº Viagem"] === "D1")!
    expect(d1["Motorista"]).toBe("João da Silva")
    expect(d1["Cavalo"]).toBe("ABC1234")
    expect(d1["Entregas"]).toBe(2)
    expect(d1["Peso (kg)"]).toBe(150)

    expect(textoDaAba(buffer, "Entregas")).toContain("Viagem D1 · João da Silva · ABC1234 / XYZ5678")
  })
})
