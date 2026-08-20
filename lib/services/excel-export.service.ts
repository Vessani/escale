import * as XLSX from "xlsx"
import type { Prisma, TipoProduto } from "@prisma/client"
import { formatarDataHoraPtBr } from "@/lib/utils/date-format"
import { formatarProduto } from "@/lib/services/produto.service"

export function sanitizarNomeArquivo(nome: string) {
  return nome.replace(/[\\/:*?"<>|]/g, "-")
}

function gerarBuffer(planilhas: Array<{ nome: string; linhas: Record<string, unknown>[] }>): Buffer {
  const workbook = XLSX.utils.book_new()

  for (const { nome, linhas } of planilhas) {
    const aba = XLSX.utils.json_to_sheet(linhas)
    XLSX.utils.book_append_sheet(workbook, aba, nome)
  }

  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer
}

type ViagemParaExportacao = {
  numViagem: string
  status: string
  turno: string
  produto: TipoProduto | null
  inicioPrevisto: Date | string
  fimPrevisto: Date | string
  diasViagem: number
  cavalo: string
  carreta: string
  tanque: string
  motorista: { nome: string; cpf: string | null } | null
  motoristaAcompanhante: { nome: string } | null
  integracaoExigida: string | null
  entregas: Array<{
    dataEntrega: Date | string
    cliente: string
    cidade: string
    uf: string
    kg: Prisma.Decimal | number
    m3: Prisma.Decimal | number
    sapcode: string
    codewhite: string
    obs: string
  }>
}

/**
 * Workbook de uma única viagem — duas abas: "Viagem" (dados gerais, uma
 * linha) e "Entregas" (uma linha por entrega). Substitui o antigo PDF (ver
 * histórico de app/api/viagens/[id]/pdf) — mesmo escopo de dados, cabeçalhos
 * em português.
 */
export function gerarExcelViagem(viagem: ViagemParaExportacao): Buffer {
  const linhaViagem = [
    {
      "Nº Viagem": viagem.numViagem,
      Status: viagem.status,
      Turno: viagem.turno,
      Produto: formatarProduto(viagem.produto),
      "Início Previsto": formatarDataHoraPtBr(viagem.inicioPrevisto),
      "Fim Previsto": formatarDataHoraPtBr(viagem.fimPrevisto),
      "Duração (dias)": viagem.diasViagem,
      Cavalo: viagem.cavalo,
      Carreta: viagem.carreta,
      Tanque: viagem.tanque,
      Motorista: viagem.motorista?.nome ?? "Não alocado",
      Acompanhante: viagem.motoristaAcompanhante?.nome ?? "",
      "Integração Exigida": viagem.integracaoExigida ?? "Não",
    },
  ]

  const linhasEntregas =
    viagem.entregas.length > 0
      ? viagem.entregas.map((entrega) => ({
          Data: formatarDataHoraPtBr(entrega.dataEntrega),
          Cliente: entrega.cliente,
          Cidade: entrega.cidade,
          UF: entrega.uf,
          "Peso (kg)": Number(entrega.kg),
          "Volume (m³)": Number(entrega.m3),
          "SAP Code": entrega.sapcode,
          "Code White": entrega.codewhite,
          Observação: entrega.obs,
        }))
      : [{ Data: "", Cliente: "Nenhuma entrega cadastrada", Cidade: "", UF: "", "Peso (kg)": "", "Volume (m³)": "", "SAP Code": "", "Code White": "", Observação: "" }]

  return gerarBuffer([
    { nome: "Viagem", linhas: linhaViagem },
    { nome: "Entregas", linhas: linhasEntregas },
  ])
}

type ViagemParaRelatorio = {
  numViagem: string
  status: string
  turno: string
  produto: TipoProduto | null
  inicioPrevisto: Date | string
  fimPrevisto: Date | string
  cavalo: string
  carreta: string
  tanque: string
  motorista: { nome: string; cpf: string | null } | null
  motoristaAcompanhante: { nome: string } | null
  integracaoExigida: string | null
}

function linhaRelatorio(viagem: ViagemParaRelatorio) {
  return {
    "Nº Viagem": viagem.numViagem,
    Status: viagem.status,
    Turno: viagem.turno,
    Produto: formatarProduto(viagem.produto),
    "Início Previsto": formatarDataHoraPtBr(viagem.inicioPrevisto),
    "Fim Previsto": formatarDataHoraPtBr(viagem.fimPrevisto),
    Cavalo: viagem.cavalo,
    Carreta: viagem.carreta,
    Tanque: viagem.tanque,
    Motorista: viagem.motorista?.nome ?? "Não alocado",
    "CPF Motorista": viagem.motorista?.cpf ?? "",
    Acompanhante: viagem.motoristaAcompanhante?.nome ?? "",
    "Integração Exigida": viagem.integracaoExigida ?? "Não",
  }
}

/** Relatório geral: viagens de qualquer status, cruzadas com motorista/frota nas colunas — um Excel só (ver plano). */
export function gerarExcelRelatorioGeral(viagens: ViagemParaRelatorio[]): Buffer {
  return gerarBuffer([{ nome: "Viagens", linhas: viagens.map(linhaRelatorio) }])
}

/** Viagens alocadas de um motorista específico — pra enviar individualmente pra ele. */
export function gerarExcelViagensMotorista(viagens: ViagemParaRelatorio[]): Buffer {
  return gerarBuffer([{ nome: "Viagens", linhas: viagens.map(linhaRelatorio) }])
}

/** Viagens criadas num dia — pra enviar pra operação. */
export function gerarExcelViagensCriadasHoje(viagens: ViagemParaRelatorio[]): Buffer {
  return gerarBuffer([{ nome: "Viagens", linhas: viagens.map(linhaRelatorio) }])
}
