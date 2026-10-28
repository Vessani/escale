import { buscarCoberturaRelatorioJornada } from "@/lib/queries/filiais"
import { DIAS_ANTES_PARA_CICLO, buscarAutorizacoesEstouro, carregarDadosJornada } from "@/lib/queries/relatorios/jornada"
import { ciclosDe72h, estourosDeJornada } from "@/lib/services/relatorios/jornada-analise"
import type { Periodo } from "@/lib/relatorios/periodo"

const UM_DIA_MS = 24 * 60 * 60 * 1000

/** Relatório de estouro de jornada (tela e Excel): jornadas acima do limite, com quem autorizou. */
export async function carregarEstourosDeJornada(filialId: number, periodo: Periodo, limiteHoras: number) {
  const [dados, autorizacoes] = await Promise.all([
    carregarDadosJornada(filialId, periodo.de, periodo.ate),
    buscarAutorizacoesEstouro(filialId, periodo.de, periodo.ate),
  ])
  return estourosDeJornada(dados.motoristas, dados.jornadas, dados.viagens, periodo.de, periodo.ate, limiteHoras, autorizacoes)
}

/** Relatório de ciclo de 72h (tela e Excel): ciclos perto ou acima das 72h, com os estouros autorizados dentro. */
export async function carregarCiclos72h(filialId: number, periodo: Periodo, alertaHoras: number) {
  const desde = new Date(periodo.de.getTime() - DIAS_ANTES_PARA_CICLO * UM_DIA_MS)
  const [dados, autorizacoes, coberturaAte] = await Promise.all([
    carregarDadosJornada(filialId, periodo.de, periodo.ate, { diasAntes: DIAS_ANTES_PARA_CICLO }),
    buscarAutorizacoesEstouro(filialId, desde, periodo.ate),
    buscarCoberturaRelatorioJornada(filialId),
  ])
  const ciclos = ciclosDe72h(dados.motoristas, dados.jornadas, dados.viagens, periodo.de, periodo.ate, {
    alertaHoras,
    autorizacoes,
    coberturaAte,
  })
  return { ciclos, coberturaAte }
}
