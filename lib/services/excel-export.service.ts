import { excelOrdemDeViagem, type EntregaExcel, type ViagemExcel } from "@/lib/excel/viagens"
import type { Metadados } from "@/lib/excel/planilha"

/**
 * Planilha de uma viagem (ordem de viagem, download no Dashboard e na Gestão de Viagens). A
 * montagem visual fica em lib/excel/ — aqui só o que vai em cada uma.
 */

export function sanitizarNomeArquivo(nome: string) {
  return nome.replace(/[\\/:*?"<>|]/g, "-")
}

/** Ordem de viagem: uma viagem numa página, pra imprimir ou mandar pro motorista. */
export function gerarExcelViagem(viagem: ViagemExcel & { entregas: EntregaExcel[] }, meta?: Metadados): Promise<Buffer> {
  return excelOrdemDeViagem(viagem, meta)
}
