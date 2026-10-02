import ExcelJS from "exceljs"
import type { Prisma, StatusViagem, TipoProduto } from "@prisma/client"
import { formatarDataHoraPtBr } from "@/lib/utils/date-format"
import { formatarNomeProprio, paradasDaRota } from "@/lib/utils/texto"
import { formatarProduto } from "@/lib/services/produto.service"
import { formatarStatusViagem } from "@/lib/services/viagem-status.service"
import { formatarCodigoFrota } from "@/lib/services/frota-regras"
import { minutosDeAtraso, saidaAtrasada } from "@/lib/services/pontualidade"
import { BORDA_FINA, CORES, aba, gerarExcel, paraHorarioDeParede, preencher, type Metadados } from "./planilha"

type Decimal = Prisma.Decimal | number

export type EntregaExcel = {
  dataEntrega: Date | string
  cliente: string
  cidade: string
  uf: string
  kg: Decimal
  m3: Decimal
  sapcode: string
  codewhite: string
  obs: string
}

export type ViagemExcel = {
  numViagem: string
  status: StatusViagem
  turno: string
  produto: TipoProduto | null
  inicioPrevisto: Date | string
  fimPrevisto: Date | string
  diasViagem?: number
  cavalo: string
  carreta: string
  tanque: string
  motorista: { nome: string; cpf?: string | null } | null
  motoristaAcompanhante: { nome: string } | null
  integracaoExigida: string | null
  viagemExtra: boolean
  horarioRealSaida?: Date | string | null
  motivoAtraso?: string | null
  entregas?: Array<Partial<EntregaExcel> & { cidade?: string; cliente?: string; sapcode?: string }>
}

const nome = (texto: string | null | undefined) => (texto ? formatarNomeProprio(texto) : "")
const data = (valor: Date | string | null | undefined) => (valor ? new Date(valor) : null)
const turno = (valor: string) => (valor === "NOITE" ? "Noite" : "Dia")
const frota = (codigo: string) => formatarCodigoFrota(codigo).replace("—", "")


function rota(viagem: ViagemExcel): string {
  return paradasDaRota((viagem.entregas ?? []).map((entrega) => entrega.cidade)).join(" › ")
}

function clientes(viagem: ViagemExcel): string {
  return [...new Set((viagem.entregas ?? []).map((entrega) => nome(entrega.cliente)).filter(Boolean))].join(", ")
}

function pesoTotal(viagem: ViagemExcel): number {
  return (viagem.entregas ?? []).reduce((soma, entrega) => soma + Number(entrega.kg ?? 0), 0)
}

// ---------------------------------------------------------------------------
// Lista de viagens (relatório geral, viagens do motorista, criadas no dia)
// ---------------------------------------------------------------------------

export async function excelListaViagens(opcoes: {
  titulo: string
  subtitulo?: string
  viagens: ViagemExcel[]
  meta?: Metadados
  /** Inclui a coluna de CPF (relatório geral, pra portaria de cliente). */
  comCpf?: boolean
  resumo?: Array<{ rotulo: string; valor: string | number }>
}): Promise<Buffer> {
  return gerarExcel(
    [
      aba<ViagemExcel>({
        nome: "Viagens",
        titulo: opcoes.titulo,
        subtitulo: opcoes.subtitulo,
        resumo: opcoes.resumo ?? [{ rotulo: "Viagens", valor: opcoes.viagens.length }],
        linhas: opcoes.viagens,
        destaque: (viagem) => (viagem.status === "CANCELADA" ? "apagado" : !viagem.motorista ? "alerta" : null),
        colunas: [
          { titulo: "Nº Viagem", valor: (v) => v.numViagem, tipo: "codigo" },
          { titulo: "Status", valor: (v) => formatarStatusViagem(v.status) },
          { titulo: "Turno", valor: (v) => turno(v.turno) },
          { titulo: "Produto", valor: (v) => formatarProduto(v.produto) },
          { titulo: "Início previsto", valor: (v) => data(v.inicioPrevisto), tipo: "dataHora" },
          { titulo: "Fim previsto", valor: (v) => data(v.fimPrevisto), tipo: "dataHora" },
          { titulo: "Motorista", valor: (v) => (v.motorista ? nome(v.motorista.nome) : "Não alocado") },
          ...(opcoes.comCpf ? [{ titulo: "CPF", valor: (v: ViagemExcel) => v.motorista?.cpf ?? "", tipo: "codigo" as const }] : []),
          { titulo: "Acompanhante", valor: (v) => nome(v.motoristaAcompanhante?.nome) },
          { titulo: "Cavalo", valor: (v) => frota(v.cavalo), tipo: "codigo" },
          { titulo: "Carreta", valor: (v) => frota(v.carreta), tipo: "codigo" },
          { titulo: "Tanque", valor: (v) => v.tanque, tipo: "codigo" },
          { titulo: "Rota", valor: (v) => rota(v), largura: 40 },
          { titulo: "Integração", valor: (v) => v.integracaoExigida ?? "" },
          { titulo: "Extra", valor: (v) => (v.viagemExtra ? "Sim" : "") },
        ],
      }),
    ],
    opcoes.meta,
  )
}

// ---------------------------------------------------------------------------
// Programação do dia
// ---------------------------------------------------------------------------

type LinhaEntrega = EntregaExcel & { viagem: ViagemExcel }

const ORDEM_TURNO: Record<string, number> = { MANHA: 0, NOITE: 1 }

/**
 * Todas as viagens de um dia, pra mandar pra operação ou pros motoristas:
 * aba "Programação" (uma linha por viagem, separada por turno, com
 * motorista, acompanhante, frota, rota e saída real) e aba "Entregas"
 * (cada entrega, agrupada por viagem). Sem motorista em amarelo; cancelada
 * apagada no fim de cada turno.
 */
export async function excelProgramacaoDoDia(opcoes: { dia: Date; viagens: ViagemExcel[]; meta?: Metadados }): Promise<Buffer> {
  const diaTexto = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(opcoes.dia)

  const viagens = [...opcoes.viagens].sort(
    (a, b) =>
      (ORDEM_TURNO[a.turno] ?? 9) - (ORDEM_TURNO[b.turno] ?? 9) ||
      Number(a.status === "CANCELADA") - Number(b.status === "CANCELADA") ||
      new Date(a.inicioPrevisto).getTime() - new Date(b.inicioPrevisto).getTime(),
  )
  const ativas = viagens.filter((viagem) => viagem.status !== "CANCELADA")
  const contar = (filtro: (viagem: ViagemExcel) => boolean) => ativas.filter(filtro).length
  const entregas: LinhaEntrega[] = ativas.flatMap((viagem) =>
    (viagem.entregas ?? []).map((entrega) => ({ ...(entrega as EntregaExcel), viagem })),
  )

  return gerarExcel(
    [
      aba<ViagemExcel>({
        nome: "Programação",
        titulo: `Programação de viagens · ${diaTexto}`,
        resumo: [
          { rotulo: "Viagens", valor: ativas.length },
          { rotulo: "Dia", valor: contar((v) => v.turno === "MANHA") },
          { rotulo: "Noite", valor: contar((v) => v.turno === "NOITE") },
          { rotulo: "Sem motorista", valor: contar((v) => !v.motorista) },
          { rotulo: "Entregas", valor: entregas.length },
          ...(viagens.length > ativas.length ? [{ rotulo: "Canceladas", valor: viagens.length - ativas.length }] : []),
        ],
        linhas: viagens,
        grupo: (v) => `Turno ${turno(v.turno).toLowerCase()}`,
        destaque: (v) => (v.status === "CANCELADA" ? "apagado" : !v.motorista ? "alerta" : null),
        vazio: "Nenhuma viagem programada pra esse dia.",
        colunas: [
          { titulo: "Início", valor: (v) => data(v.inicioPrevisto), tipo: "hora", largura: 8 },
          { titulo: "Nº Viagem", valor: (v) => v.numViagem, tipo: "codigo" },
          { titulo: "Status", valor: (v) => formatarStatusViagem(v.status) },
          { titulo: "Produto", valor: (v) => formatarProduto(v.produto) },
          { titulo: "Motorista", valor: (v) => (v.motorista ? nome(v.motorista.nome) : "Sem motorista") },
          { titulo: "Acompanhante", valor: (v) => nome(v.motoristaAcompanhante?.nome) },
          { titulo: "Cavalo", valor: (v) => frota(v.cavalo), tipo: "codigo", largura: 9 },
          { titulo: "Carreta", valor: (v) => frota(v.carreta), tipo: "codigo", largura: 9 },
          { titulo: "Tanque", valor: (v) => v.tanque, tipo: "codigo", largura: 9 },
          { titulo: "Rota", valor: (v) => rota(v), largura: 36 },
          { titulo: "Clientes", valor: (v) => clientes(v), largura: 32 },
          { titulo: "Entregas", valor: (v) => (v.entregas ?? []).length, tipo: "numero", somar: true },
          { titulo: "Peso (kg)", valor: (v) => pesoTotal(v), tipo: "numero", somar: true },
          { titulo: "Fim previsto", valor: (v) => data(v.fimPrevisto), tipo: "dataHora" },
          { titulo: "Saída real", valor: (v) => data(v.horarioRealSaida), tipo: "hora", largura: 10 },
          {
            titulo: "Atraso",
            valor: (v) => {
              if (!v.horarioRealSaida) return ""
              const minutos = minutosDeAtraso(v.inicioPrevisto, v.horarioRealSaida)
              return saidaAtrasada(minutos) ? `+${minutos} min` : "No horário"
            },
          },
        ],
      }),
      aba<LinhaEntrega>({
        nome: "Entregas",
        titulo: `Entregas · ${diaTexto}`,
        resumo: [
          { rotulo: "Entregas", valor: entregas.length },
          { rotulo: "Peso total (kg)", valor: Math.round(entregas.reduce((soma, e) => soma + Number(e.kg), 0)).toLocaleString("pt-BR") },
        ],
        linhas: entregas,
        grupo: (e) =>
          [
            `Viagem ${e.viagem.numViagem}`,
            e.viagem.motorista ? nome(e.viagem.motorista.nome) : "sem motorista",
            [frota(e.viagem.cavalo), frota(e.viagem.carreta)].filter(Boolean).join(" / "),
          ]
            .filter(Boolean)
            .join(" · "),
        vazio: "Nenhuma entrega nas viagens do dia.",
        colunas: [
          { titulo: "Data", valor: (e) => data(e.dataEntrega), tipo: "dataHora" },
          { titulo: "Cliente", valor: (e) => e.cliente, largura: 34 },
          { titulo: "Cidade", valor: (e) => nome(e.cidade) },
          { titulo: "UF", valor: (e) => e.uf, largura: 5 },
          { titulo: "Peso (kg)", valor: (e) => Number(e.kg), tipo: "numero", somar: true },
          { titulo: "Volume (m³)", valor: (e) => Number(e.m3), tipo: "decimal", somar: true },
          { titulo: "SAP Code", valor: (e) => e.sapcode, tipo: "codigo" },
          { titulo: "Code White", valor: (e) => e.codewhite, tipo: "codigo" },
          { titulo: "Observação", valor: (e) => e.obs, largura: 30 },
        ],
      }),
    ],
    opcoes.meta,
  )
}

// ---------------------------------------------------------------------------
// Ordem de viagem (uma viagem, pra enviar pro motorista)
// ---------------------------------------------------------------------------

const COLUNAS_ORDEM = 10

/**
 * Uma viagem numa página A4 em pé, pronta pra imprimir ou mandar pro
 * motorista: equipe e frota, horários, rota com todas as entregas (com
 * totais) e espaço pra conferência e assinatura.
 */
export async function excelOrdemDeViagem(viagem: ViagemExcel & { entregas: EntregaExcel[] }, meta: Metadados = {}): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = "Escalador"
  const planilha = workbook.addWorksheet("Ordem de viagem", {
    views: [{ showGridLines: false }],
    pageSetup: {
      orientation: "portrait",
      paperSize: 9,
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 },
    },
    headerFooter: { oddFooter: "&L&8Escalador&R&8Página &P de &N" },
  })
  const larguras = [5, 16, 30, 18, 5, 11, 11, 12, 12, 24]
  larguras.forEach((largura, indice) => (planilha.getColumn(indice + 1).width = largura))

  let linha = 1
  const faixa = (texto: string, estilo: "titulo" | "secao") => {
    planilha.mergeCells(linha, 1, linha, COLUNAS_ORDEM)
    const celula = planilha.getCell(linha, 1)
    celula.value = texto
    celula.alignment = { vertical: "middle", indent: 1 }
    if (estilo === "titulo") {
      celula.font = { size: 16, bold: true, color: { argb: "FFFFFFFF" } }
      celula.fill = preencher(CORES.marinho)
      planilha.getRow(linha).height = 32
    } else {
      celula.font = { size: 11, bold: true, color: { argb: CORES.marinho } }
      celula.fill = preencher(CORES.secao)
      celula.border = { bottom: { style: "medium", color: { argb: CORES.azul } } }
      planilha.getRow(linha).height = 22
    }
    linha++
  }

  /** Dois pares rótulo/valor por linha: A-B / C-E e F-G / H-J. */
  const pares = (itens: Array<[string, ExcelJS.CellValue]>) => {
    for (let i = 0; i < itens.length; i += 2) {
      const blocos: Array<[number, number, number, number]> = [
        [1, 2, 3, 5],
        [6, 7, 8, 10],
      ]
      blocos.forEach(([rotuloDe, rotuloAte, valorDe, valorAte], indice) => {
        const item = itens[i + indice]
        planilha.mergeCells(linha, rotuloDe, linha, rotuloAte)
        planilha.mergeCells(linha, valorDe, linha, valorAte)
        const rotulo = planilha.getCell(linha, rotuloDe)
        const valor = planilha.getCell(linha, valorDe)
        rotulo.value = item?.[0] ?? null
        rotulo.font = { size: 9, color: { argb: CORES.cinza } }
        rotulo.alignment = { vertical: "middle", indent: 1 }
        valor.value = item?.[1] ?? null
        valor.font = { size: 11, bold: true, color: { argb: CORES.texto } }
        valor.alignment = { vertical: "middle", horizontal: "left", wrapText: true }
        if (valor.value instanceof Date) valor.numFmt = "dd/mm/yyyy hh:mm"
        for (let coluna = rotuloDe; coluna <= valorAte; coluna++) {
          planilha.getCell(linha, coluna).border = { bottom: { style: "thin", color: { argb: CORES.borda } } }
        }
      })
      planilha.getRow(linha).height = 22
      linha++
    }
  }

  faixa(`Ordem de viagem · Nº ${viagem.numViagem}`, "titulo")
  planilha.mergeCells(linha, 1, linha, COLUNAS_ORDEM)
  const contexto = planilha.getCell(linha, 1)
  contexto.value = [
    formatarStatusViagem(viagem.status),
    formatarProduto(viagem.produto),
    `Turno ${turno(viagem.turno).toLowerCase()}`,
    viagem.viagemExtra ? "Viagem extra" : null,
    meta.filial ? `Filial ${meta.filial}` : null,
    `Gerado em ${formatarDataHoraPtBr(meta.geradoEm ?? new Date())}`,
  ]
    .filter(Boolean)
    .join("  ·  ")
  contexto.font = { size: 9, color: { argb: CORES.cinza } }
  contexto.alignment = { indent: 1, vertical: "middle" }
  planilha.getRow(linha).height = 18
  linha += 2

  faixa("Equipe e frota", "secao")
  pares([
    ["Motorista", viagem.motorista ? nome(viagem.motorista.nome) : "Não alocado"],
    ["Acompanhante", nome(viagem.motoristaAcompanhante?.nome) || "—"],
    ["Cavalo", frota(viagem.cavalo) || "—"],
    ["Carreta", frota(viagem.carreta) || "—"],
    ["Tanque", viagem.tanque || "—"],
    ["Integração exigida", viagem.integracaoExigida ?? "Não"],
  ])
  linha++

  faixa("Horários", "secao")
  pares([
    ["Início previsto", paraHorarioDeParede(new Date(viagem.inicioPrevisto))],
    ["Fim previsto", paraHorarioDeParede(new Date(viagem.fimPrevisto))],
    ["Duração", viagem.diasViagem ? `${viagem.diasViagem} dia(s)` : "—"],
    ["Rota", rota(viagem) || "—"],
  ])
  linha++

  const reais = viagem.entregas as EntregaExcel[]
  faixa(`Entregas (${reais.length})`, "secao")
  const titulos = ["#", "Data", "Cliente", "Cidade", "UF", "Peso (kg)", "Volume (m³)", "SAP Code", "Code White", "Observação"]
  const cabecalho = planilha.getRow(linha)
  titulos.forEach((titulo, indice) => {
    const celula = cabecalho.getCell(indice + 1)
    celula.value = titulo
    celula.font = { bold: true, size: 10, color: { argb: "FFFFFFFF" } }
    celula.fill = preencher(CORES.azul)
    celula.alignment = { vertical: "middle", horizontal: indice >= 5 && indice <= 6 ? "right" : "left", wrapText: true }
    celula.border = BORDA_FINA
  })
  cabecalho.height = 22
  linha++

  if (reais.length === 0) {
    planilha.mergeCells(linha, 1, linha, COLUNAS_ORDEM)
    const vazio = planilha.getCell(linha, 1)
    vazio.value = "Nenhuma entrega cadastrada."
    vazio.font = { italic: true, color: { argb: CORES.cinza } }
    vazio.alignment = { horizontal: "center" }
    linha++
  }

  reais.forEach((entrega, indice) => {
    const valores: ExcelJS.CellValue[] = [
      indice + 1,
      paraHorarioDeParede(new Date(entrega.dataEntrega)),
      entrega.cliente,
      nome(entrega.cidade),
      entrega.uf,
      Number(entrega.kg),
      Number(entrega.m3),
      entrega.sapcode,
      entrega.codewhite,
      entrega.obs,
    ]
    const linhaEntrega = planilha.getRow(linha)
    valores.forEach((valor, coluna) => {
      const celula = linhaEntrega.getCell(coluna + 1)
      celula.value = valor
      celula.font = { size: 10, color: { argb: CORES.texto } }
      celula.border = BORDA_FINA
      celula.alignment = { vertical: "middle", wrapText: coluna === 2 || coluna === 9, horizontal: coluna >= 5 && coluna <= 6 ? "right" : "left" }
      if (coluna === 1) celula.numFmt = "dd/mm hh:mm"
      if (coluna === 5) celula.numFmt = "#,##0"
      if (coluna === 6) celula.numFmt = "#,##0.00"
      if (indice % 2 === 1) celula.fill = preencher(CORES.zebra)
    })
    linha++
  })

  if (reais.length > 0) {
    const totais = planilha.getRow(linha)
    const somaKg = reais.reduce((soma, entrega) => soma + Number(entrega.kg), 0)
    const somaM3 = reais.reduce((soma, entrega) => soma + Number(entrega.m3), 0)
    for (let coluna = 1; coluna <= COLUNAS_ORDEM; coluna++) {
      const celula = totais.getCell(coluna)
      celula.font = { bold: true, size: 10, color: { argb: CORES.marinho } }
      celula.fill = preencher(CORES.secao)
      celula.border = { ...BORDA_FINA, top: { style: "medium", color: { argb: CORES.azul } } }
    }
    totais.getCell(3).value = "Total"
    totais.getCell(6).value = somaKg
    totais.getCell(6).numFmt = "#,##0"
    totais.getCell(6).alignment = { horizontal: "right" }
    totais.getCell(7).value = somaM3
    totais.getCell(7).numFmt = "#,##0.00"
    totais.getCell(7).alignment = { horizontal: "right" }
    totais.height = 20
    linha++
  }

  linha += 3
  for (const [de, ate, texto] of [
    [1, 4, "Conferido por (operação)"],
    [6, 10, "Assinatura do motorista"],
  ] as const) {
    planilha.mergeCells(linha, de, linha, ate)
    for (let coluna = de; coluna <= ate; coluna++) {
      planilha.getCell(linha, coluna).border = { top: { style: "thin", color: { argb: CORES.texto } } }
    }
    const celula = planilha.getCell(linha, de)
    celula.value = texto
    celula.font = { size: 9, color: { argb: CORES.cinza } }
    celula.alignment = { horizontal: "center" }
  }

  return Buffer.from(await workbook.xlsx.writeBuffer())
}
