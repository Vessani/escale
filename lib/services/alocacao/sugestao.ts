import { TipoProduto, Turno } from "@prisma/client"
import { descansoMinimoNecessarioApos, filtrarMotoristasDisponiveisNoPeriodo, periodosConflitamComDescanso } from "./disponibilidade"
import { filtrarMotoristasCompativeis } from "./priorizacao"
import type { ContextoCompatibilidade, MotoristaComAgenda } from "./tipos"

export function sugerirMotoristaAutomatico(
  motoristas: MotoristaComAgenda[],
  fimViagem: Date,
  contexto: ContextoCompatibilidade,
) {
  const disponiveis = filtrarMotoristasDisponiveisNoPeriodo(
    motoristas,
    contexto.dataInicioViagem,
    fimViagem,
    contexto.hoje,
  )
  const compativeis = filtrarMotoristasCompativeis(disponiveis, contexto)
  return compativeis[0] ?? null
}

type ViagemParaSugestaoLote = {
  id: number
  turno: Turno
  diasViagem: number
  inicioPrevisto: Date
  fimPrevisto: Date
  integracaoExigida: string | null
  produtoExigido?: TipoProduto | null
}

type AtribuicaoTentativa = {
  motoristaId: number
  motorista: MotoristaComAgenda
  inicio: Date
  fim: Date
}

export type SugestaoAlocacaoLote = {
  viagemId: number
  motoristasCompativeis: MotoristaComAgenda[]
  motoristaSugerido: MotoristaComAgenda | null
}

/**
 * Sugere motorista para um lote de viagens pendentes, processando em ordem e
 * levando em conta as sugestões já feitas às viagens anteriores do mesmo lote:
 * se duas viagens têm período sobreposto, a segunda não recebe o motorista já
 * sugerido para a primeira, mesmo que ele também seja compatível para ela.
 * Também exclui motoristas com viagem real conflitante já registrada no banco.
 */
export function sugerirAlocacoesEmLote(
  viagens: ViagemParaSugestaoLote[],
  motoristas: MotoristaComAgenda[],
  hoje: Date,
): SugestaoAlocacaoLote[] {
  const atribuicoesTentativas: AtribuicaoTentativa[] = []

  return viagens.map((viagem) => {
    const contexto: ContextoCompatibilidade = {
      turnoViagem: viagem.turno,
      diasViagem: viagem.diasViagem,
      dataInicioViagem: viagem.inicioPrevisto,
      integracaoExigida: viagem.integracaoExigida,
      produtoExigido: viagem.produtoExigido,
      hoje,
    }

    const motoristasDisponiveis = filtrarMotoristasDisponiveisNoPeriodo(
      motoristas,
      viagem.inicioPrevisto,
      viagem.fimPrevisto,
      hoje,
    )

    const motoristasCompativeis = filtrarMotoristasCompativeis(motoristasDisponiveis, contexto).filter(
      (motorista) =>
        !atribuicoesTentativas.some((atribuicao) => {
          if (atribuicao.motoristaId !== motorista.id) return false

          const minimoHoras = descansoMinimoNecessarioApos(atribuicao.motorista, atribuicao.fim, hoje)
          return periodosConflitamComDescanso(
            viagem.inicioPrevisto,
            viagem.fimPrevisto,
            atribuicao.inicio,
            atribuicao.fim,
            minimoHoras,
          )
        }),
    )

    // motoristasCompativeis já está filtrado e ordenado por filtrarMotoristasCompativeis
    // (mesmo critério usado por sugerirMotoristaAutomatico); o primeiro é o sugerido.
    const motoristaSugerido = motoristasCompativeis[0] ?? null

    if (motoristaSugerido) {
      atribuicoesTentativas.push({
        motoristaId: motoristaSugerido.id,
        motorista: motoristaSugerido,
        inicio: viagem.inicioPrevisto,
        fim: viagem.fimPrevisto,
      })
    }

    return { viagemId: viagem.id, motoristasCompativeis, motoristaSugerido }
  })
}
