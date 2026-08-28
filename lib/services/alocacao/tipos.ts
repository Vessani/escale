import { StatusIntegracao, StatusViagem, TipoProduto, Turno } from "@prisma/client"
import type { PontoRegistroJornada } from "../jornada.service"

// Tipos compartilhados entre os módulos de lib/services/alocacao/ — eram
// privados do antigo alocacao.service.ts (um arquivo só, sem fronteira de
// módulo); exportados aqui só pra permitir a divisão em arquivos, sem virar
// API pública nova de propósito (ver comentário no barrel alocacao.service.ts).

export type IntegracaoBase = {
  cliente: string
  status: StatusIntegracao
  dataValidade: Date | string
}

export type MotoristaParaAlocacao = {
  id: number
  nome: string
  turno: Turno
  diasTrabalhados: number
  /** false = em treinamento — nunca compatível como motorista principal (ver motoristaEhCompativel). */
  liberado: boolean
  integracao: IntegracaoBase[]
  registrosJornada: PontoRegistroJornada[]
  /** Último registro do Relatório Sintético de Jornada importado (ver jornada-relatorio.service.ts). */
  jornadaRelatorioInicio: Date | string | null
  jornadaRelatorioFim: Date | string | null
  /** Gases que o motorista está autorizado a transportar — [] pra quem ainda não foi editado desde que o campo existe (bloqueia qualquer viagem com produto exigido, ver motoristaEhCompativel). */
  produtosAutorizados: TipoProduto[]
}

export type ViagemParaDisponibilidade = {
  id: number
  inicioPrevisto: Date | string
  fimPrevisto: Date | string
  status: StatusViagem
  deletadoEm?: Date | string | null
}

export type MotoristaComAgenda = MotoristaParaAlocacao & {
  viagens: ViagemParaDisponibilidade[]
}

export type ContextoCompatibilidade = {
  turnoViagem: Turno
  diasViagem: number
  dataInicioViagem: Date
  integracaoExigida: string | null
  /**
   * Opcional de propósito: `undefined`/`null` (viagem sem produto definido —
   * ex: criada antes desse campo existir) se comporta como "sem restrição",
   * mesmo espírito de integracaoExigida. Ver motoristaEhCompativel.
   */
  produtoExigido?: TipoProduto | null
  /** "Hoje" do ponto de vista de quem está alocando — âncora usada para projetar a jornada do motorista em `dataInicioViagem`. */
  hoje: Date
}
