import { PDFDocument, StandardFonts, rgb } from "pdf-lib"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { buscarViagemPorId } from "@/lib/queries/viagens"
import { formatarDataHoraPtBr } from "@/lib/utils/date-format"

function formatarNumero(valor: number) {
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(valor)
}

function sanitizarNomeArquivo(nome: string) {
  return nome.replace(/[\\/:*?"<>|]/g, "-")
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return new Response("Não autorizado.", { status: 401 })
  }

  const { id } = await params
  const viagemId = Number.parseInt(id, 10)
  if (!Number.isInteger(viagemId)) {
    return new Response("ID de viagem inválido.", { status: 400 })
  }

  const viagem = await buscarViagemPorId(viagemId)
  if (!viagem) {
    return new Response("Viagem não encontrada.", { status: 404 })
  }

  const pdf = await PDFDocument.create()
  const fonteNormal = await pdf.embedFont(StandardFonts.Helvetica)
  const fonteNegrito = await pdf.embedFont(StandardFonts.HelveticaBold)
  let pagina = pdf.addPage([595, 842])
  let y = 810
  const margemEsquerda = 40
  const larguraUtil = 515

  const novaPagina = () => {
    pagina = pdf.addPage([595, 842])
    y = 810
  }

  const garantirEspaco = (alturaNecessaria: number) => {
    if (y - alturaNecessaria < 40) {
      novaPagina()
    }
  }

  const escreverTitulo = (texto: string) => {
    garantirEspaco(30)
    pagina.drawText(texto, {
      x: margemEsquerda,
      y,
      size: 18,
      font: fonteNegrito,
      color: rgb(0.07, 0.16, 0.31),
    })
    y -= 24
  }

  const escreverLinhaInfo = (chave: string, valor: string) => {
    garantirEspaco(18)
    pagina.drawText(`${chave}:`, {
      x: margemEsquerda,
      y,
      size: 10,
      font: fonteNegrito,
      color: rgb(0.15, 0.15, 0.15),
    })
    pagina.drawText(valor || "-", {
      x: margemEsquerda + 120,
      y,
      size: 10,
      font: fonteNormal,
      color: rgb(0.2, 0.2, 0.2),
    })
    y -= 14
  }

  const escreverParagrafo = (texto: string) => {
    const palavras = texto.split(" ")
    let linha = ""
    const linhas: string[] = []

    for (const palavra of palavras) {
      const tentativa = linha ? `${linha} ${palavra}` : palavra
      const largura = fonteNormal.widthOfTextAtSize(tentativa, 9)
      if (largura > larguraUtil) {
        linhas.push(linha)
        linha = palavra
      } else {
        linha = tentativa
      }
    }

    if (linha) {
      linhas.push(linha)
    }

    for (const trecho of linhas) {
      garantirEspaco(14)
      pagina.drawText(trecho, {
        x: margemEsquerda,
        y,
        size: 9,
        font: fonteNormal,
        color: rgb(0.2, 0.2, 0.2),
      })
      y -= 12
    }
  }

  escreverTitulo(`Relatório da Viagem ${viagem.numViagem}`)
  escreverLinhaInfo("Status", viagem.status)
  escreverLinhaInfo("Turno", viagem.turno)
  escreverLinhaInfo("Início previsto", formatarDataHoraPtBr(new Date(viagem.inicioPrevisto)))
  escreverLinhaInfo("Fim previsto", formatarDataHoraPtBr(new Date(viagem.fimPrevisto)))
  escreverLinhaInfo("Duração (dias)", String(viagem.diasViagem))
  escreverLinhaInfo("Cavalo", viagem.cavalo)
  escreverLinhaInfo("Carreta", viagem.carreta)
  escreverLinhaInfo("Tanque", viagem.tanque)
  escreverLinhaInfo("Motorista", viagem.motorista?.nome ?? "Não alocado")
  escreverLinhaInfo("Integração exigida", viagem.integracaoExigida ?? "Não")
  y -= 8

  escreverTitulo("Entregas")

  if (viagem.entregas.length === 0) {
    escreverParagrafo("Nenhuma entrega cadastrada para esta viagem.")
  } else {
    for (const [indice, entrega] of viagem.entregas.entries()) {
      garantirEspaco(74)
      pagina.drawText(`Entrega ${indice + 1}`, {
        x: margemEsquerda,
        y,
        size: 12,
        font: fonteNegrito,
        color: rgb(0.07, 0.16, 0.31),
      })
      y -= 16
      escreverLinhaInfo("Data", formatarDataHoraPtBr(new Date(entrega.dataEntrega)))
      escreverLinhaInfo("Cliente", entrega.cliente)
      escreverLinhaInfo("Cidade/UF", `${entrega.cidade} - ${entrega.uf}`)
      escreverLinhaInfo("Peso (kg)", formatarNumero(Number(entrega.kg)))
      escreverLinhaInfo("Volume (m³)", formatarNumero(Number(entrega.m3)))
      escreverLinhaInfo("SAP Code", entrega.sapcode)
      escreverLinhaInfo("Code White", entrega.codewhite)
      escreverLinhaInfo("Observação", entrega.obs)
      y -= 6
    }
  }

  const bytes = await pdf.save()
  const pdfBytes = new Uint8Array(bytes)
  const pdfBlob = new Blob([pdfBytes], { type: "application/pdf" })
  const nomeArquivo = sanitizarNomeArquivo(`viagem-${viagem.numViagem}.pdf`)

  return new Response(pdfBlob, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${nomeArquivo}"`,
      "Cache-Control": "no-store",
    },
  })
}
