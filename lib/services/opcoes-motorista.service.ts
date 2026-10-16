import type { TipoMotorista, TipoProduto, Turno } from "@prisma/client"
import { situacaoDoMotorista, type SituacaoMotorista } from "@/components/motorista/indicador-compatibilidade"
import {
  calcularDiasDisponiveis,
  calcularIntegracaoExigida,
  codigoJornadaNaViagem,
  motivoForaDaRegra,
  motivoIndisponivel,
} from "./alocacao.service"
import type { IntegracaoBase, ViagemParaDisponibilidade } from "./alocacao/tipos"
import { prepararJornadaDoMotorista } from "./jornada.service"
import { calcularDiasEntre } from "@/lib/utils/date-format"

/** O que o seletor de motorista precisa pra cada opção — nada além disso vai pro navegador. */
type OpcaoMotoristaServidor = {
  id: number
  nome: string
  tipo: TipoMotorista
  situacao: SituacaoMotorista
  /**
   * O porquê da cor, ao lado do nome: verde "5 dias disponíveis", laranja
   * "Em viagem até 05/10 17:00" / "Descanso até 06/10 04:00", branco/vermelho
   * "Folga em 06/10", "Turno Noite"...
   */
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
        const semDescanso = motivoIndisponivel(
          { ...motorista, viagens: motorista.viagens.filter((agendada) => agendada.id !== viagem.id) },
          inicio,
          fim,
          hoje,
        )
        const contexto = {
          turnoViagem: viagem.turno,
          diasViagem: viagem.diasViagem,
          dataInicioViagem: inicio,
          fimViagem: fim,
          integracaoExigida: viagem.integracaoExigida,
          produtoExigido: viagem.produto,
          hoje,
        }
        const foraDaRegra = motivoForaDaRegra(motorista, contexto)
        const dias = calcularDiasDisponiveis(codigoJornadaNaViagem(motorista, contexto))
        // Verde: quanto ainda cabe no ciclo. Laranja: o que impede. Fora da regra: a regra (e a agenda, se também pegar).
        const motivo = foraDaRegra
          ? [foraDaRegra, semDescanso].filter(Boolean).join(" · ")
          : (semDescanso ?? `${dias} ${dias === 1 ? "dia disponível" : "dias disponíveis"}`)

        return {
          id: motorista.id,
          nome: motorista.nome,
          tipo: motorista.tipo,
          situacao: situacaoDoMotorista(foraDaRegra === null, semDescanso === null),
          motivo,
        }
      })

      return [viagem.id, opcoes] as const
    }),
  )
}

/** O que o escalador pode mudar no formulário de edição e muda quem cabe na viagem. */
export type AgendaDoFormulario = {
  inicioPrevisto: Date
  fimPrevisto: Date
  turno: Turno
  produto: TipoProduto | null
}

type ViagemSalva = ViagemParaOpcoes & { entregas: Array<{ sapcode: string | null }> }

/**
 * Opções de motorista da tela de edição. Sem `agenda`, com a viagem como está
 * salva (abertura da tela); com `agenda`, como ela vai ficar com o que está
 * no formulário — a lista acompanha a troca de data, turno ou produto antes
 * de salvar. diasViagem sai das datas, igual ao servidor ao gravar
 * (converterEditarViagemParaBD).
 */
export function montarOpcoesDaEdicao(
  motoristas: MotoristaComAgendaBruta[],
  viagem: ViagemSalva,
  numerosSapQueExigemIntegracao: Set<string>,
  hoje: Date,
  agenda?: AgendaDoFormulario,
): OpcaoMotoristaServidor[] {
  const integracaoExigida =
    viagem.integracaoExigida ??
    calcularIntegracaoExigida(
      viagem.entregas.map((entrega) => ({ sapcode: entrega.sapcode ?? "" })),
      numerosSapQueExigemIntegracao,
    )
  const comAgenda = agenda ? { ...agenda, diasViagem: calcularDiasEntre(agenda.inicioPrevisto, agenda.fimPrevisto) } : {}

  return montarOpcoesMotoristaPorViagem(motoristas, [{ ...viagem, integracaoExigida, ...comAgenda }], hoje).get(viagem.id) ?? []
}
