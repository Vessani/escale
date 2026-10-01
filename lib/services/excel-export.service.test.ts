import { describe, expect, it } from "vitest"
import ExcelJS from "exceljs"
import {
  sanitizarNomeArquivo,
  gerarExcelViagem,
  gerarExcelRelatorioGeral,
  gerarExcelViagensMotorista,
  gerarExcelViagensCriadasHoje,
} from "@/lib/services/excel-export.service"
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

describe("listas de viagens", () => {
  it("relatório geral: uma linha por viagem, com CPF, rota e extra", async () => {
    const buffer = await gerarExcelRelatorioGeral([{ ...viagemBase, viagemExtra: true, integracaoExigida: "Cliente X" }])
    const [linha] = lerAba(buffer, "Viagens")

    expect(linha["Nº Viagem"]).toBe("123")
    expect(linha["Status"]).toBe("Alocada")
    expect(linha["Produto"]).toBe("Carbono")
    expect(linha["Motorista"]).toBe("João da Silva")
    expect(linha["CPF"]).toBe("11144477735")
    expect(linha["Rota"]).toBe("Joinville › Blumenau")
    expect(linha["Integração"]).toBe("Cliente X")
    expect(linha["Extra"]).toBe("Sim")
  })

  it("viagens do motorista: sem CPF, título com o nome", async () => {
    const buffer = await gerarExcelViagensMotorista([viagemBase], "João da Silva")
    expect(lerAba(buffer, "Viagens")[0]).not.toHaveProperty("CPF")
    expect(textoDaAba(buffer, "Viagens")).toContain("Viagens de João da Silva")
  })

  it("criadas no dia: resumo conta viagens e entregas por turno (só entrega com SAP Code)", async () => {
    const buffer = await gerarExcelViagensCriadasHoje(
      [
        { ...viagemBase, numViagem: "D1", entregas: [{ ...entrega }, { ...entrega, sapcode: "" }, { ...entrega, sapcode: "S2" }] },
        { ...viagemBase, numViagem: "D2", entregas: [{ ...entrega }] },
        { ...viagemBase, numViagem: "N1", turno: "NOITE", entregas: [{ ...entrega }, { ...entrega, sapcode: "  " }] },
      ],
      "15/08/2026",
    )

    const texto = textoDaAba(buffer, "Viagens")
    expect(texto).toContain("Viagens criadas em 15/08/2026")
    expect(texto).toContain("Viagens: 3")
    expect(texto).toContain("Dia: 2")
    expect(texto).toContain("Noite: 1")
    expect(texto).toContain("Entregas (dia): 3")
    expect(texto).toContain("Entregas (noite): 1")
    expect(lerAba(buffer, "Viagens")).toHaveLength(3)
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
