import { excelListaViagens, excelOrdemDeViagem, type EntregaExcel, type ViagemExcel } from "@/lib/excel/viagens"
import type { Metadados } from "@/lib/excel/planilha"
import { soEntregasDeCliente } from "@/lib/services/entrega-cliente"

/**
 * Planilhas de viagens (download na Gestão de Viagens e nos Relatórios). A
 * montagem visual fica em lib/excel/ — aqui só o que vai em cada uma.
 */

export function sanitizarNomeArquivo(nome: string) {
  return nome.replace(/[\\/:*?"<>|]/g, "-")
}

/** Ordem de viagem: uma viagem numa página, pra imprimir ou mandar pro motorista. */
export function gerarExcelViagem(viagem: ViagemExcel & { entregas: EntregaExcel[] }, meta?: Metadados): Promise<Buffer> {
  return excelOrdemDeViagem(viagem, meta)
}

/** Relatório geral: viagens de qualquer status, com motorista (e CPF, pra portaria de cliente) e frota. */
export function gerarExcelRelatorioGeral(viagens: ViagemExcel[], meta?: Metadados & { subtitulo?: string }): Promise<Buffer> {
  return excelListaViagens({ titulo: "Relatório geral de viagens", subtitulo: meta?.subtitulo, viagens, meta, comCpf: true })
}

/** Viagens alocadas de um motorista — pra mandar pra ele. */
export function gerarExcelViagensMotorista(viagens: ViagemExcel[], motorista: string, meta?: Metadados): Promise<Buffer> {
  return excelListaViagens({ titulo: `Viagens de ${motorista}`, subtitulo: "Alocadas, iniciadas e retornando", viagens, meta })
}

/** Entrega sem SAP code e número white é origem/anotação da planilha, não entrega de verdade. */
function contarEntregasReais(viagens: ViagemExcel[]) {
  return viagens.reduce((total, viagem) => total + soEntregasDeCliente(viagem.entregas ?? []).length, 0)
}

/**
 * Viagens criadas num dia — pra enviar pra operação, com os totais que ela
 * usa pra bater o dia (viagens e entregas por turno, extras).
 */
export function gerarExcelViagensCriadasHoje(viagens: ViagemExcel[], diaTexto: string, meta?: Metadados): Promise<Buffer> {
  const dia = viagens.filter((viagem) => viagem.turno === "MANHA")
  const noite = viagens.filter((viagem) => viagem.turno === "NOITE")
  return excelListaViagens({
    titulo: `Viagens criadas em ${diaTexto}`,
    viagens,
    meta,
    resumo: [
      { rotulo: "Viagens", valor: viagens.length },
      { rotulo: "Dia", valor: dia.length },
      { rotulo: "Noite", valor: noite.length },
      { rotulo: "Entregas (dia)", valor: contarEntregasReais(dia) },
      { rotulo: "Entregas (noite)", valor: contarEntregasReais(noite) },
      { rotulo: "Extras", valor: viagens.filter((viagem) => viagem.viagemExtra).length },
    ],
  })
}
