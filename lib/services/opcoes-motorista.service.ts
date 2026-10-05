import type { TipoMotorista, TipoProduto, Turno } from "@prisma/client"
import { situacaoDoMotorista, type SituacaoMotorista } from "@/components/motorista/indicador-compatibilidade"
import { motivoForaDaRegra, motoristaEstaDisponivelNoPeriodo } from "./alocacao.service"
import type { IntegracaoBase, ViagemParaDisponibilidade } from "./alocacao/tipos"
import { prepararJornadaDoMotorista } from "./jornada.service"

/** O que o seletor de motorista precisa pra cada opção — nada além disso vai pro navegador. */
type OpcaoMotoristaServidor = {
  id: number
  nome: string
  tipo: TipoMotorista
  situacao: SituacaoMotorista
  /** Por que está fora da regra ("Folga em 06/10", "Turno Noite"...) — null quando cabe. */
  motivo: string | null
}

type MotoristaComAgendaBruta = {
  id: number
  nome: string
  turno: Turno
  diasTrabalhados: number
  tipo: TipoMotorista
  produtosAutorizados: TipoProduto[]
  jornadaRelatorioInicio: Date | string | null
  jornadaRelatorioFim: Date | string | null
  integracao: IntegracaoBase[]
  registrosJornada: Array<{ data: Date | string; codigo: number; fimJornada?: Date | string | null }>
  /** Cobertura do Relatório de Jornada da filial — ver prepararJornadaDoMotorista. */
  filial?: { relatorioJornadaAte: Date | string | null } | null
  viagens: ViagemParaDisponibilidade[]
}

type ViagemParaOpcoes = {
  id: number
  turno: Turno
  diasViagem: number
  inicioPrevisto: Date | string
  fimPrevisto: Date | string
  integracaoExigida: string | null
  produto: TipoProduto | null
}

/**
 * Prepara, NO SERVIDOR, as opções de motorista de várias viagens de uma vez
 * (Dashboard, edição): situação de cada motorista pra cada viagem — cabe na
 * regra? está livre? — e devolve só id, nome, tipo e situação.
 *
 * Antes a lista completa de motoristas, com agenda e histórico inteiro de
 * jornada, ia pro navegador UMA VEZ POR VIAGEM, pra ele calcular a
 * compatibilidade lá — com um ano de dados, ~2 MB por viagem (12 MB num
 * dashboard com 6 viagens). O histórico também é convertido uma vez só
 * por motorista, não uma vez por viagem.
 */
export function montarOpcoesMotoristaPorViagem(
  motoristas: MotoristaComAgendaBruta[],
  viagens: ViagemParaOpcoes[],
  hoje: Date,
): Map<number, OpcaoMotoristaServidor[]> {
  const preparados = motoristas.map((motorista) => ({
    ...motorista,
    ...prepararJornadaDoMotorista(motorista),
  }))

  return new Map(
    viagens.map((viagem) => {
      const inicio = new Date(viagem.inicioPrevisto)
      const fim = new Date(viagem.fimPrevisto)

      const opcoes = preparados.map((motorista) => {
        // Ignora a própria viagem na agenda — senão quem já está nela
        // apareceria "ocupado" por causa dela mesma.
        const disponivel = motoristaEstaDisponivelNoPeriodo(
          { ...motorista, viagens: motorista.viagens.filter((agendada) => agendada.id !== viagem.id) },
          inicio,
          fim,
          hoje,
        )
        const motivo = motivoForaDaRegra(motorista, {
          turnoViagem: viagem.turno,
          diasViagem: viagem.diasViagem,
          dataInicioViagem: inicio,
          fimViagem: fim,
          integracaoExigida: viagem.integracaoExigida,
          produtoExigido: viagem.produto,
          hoje,
        })

        return {
          id: motorista.id,
          nome: motorista.nome,
          tipo: motorista.tipo,
          situacao: situacaoDoMotorista(motivo === null, disponivel),
          motivo,
        }
      })

      return [viagem.id, opcoes] as const
    }),
  )
}
