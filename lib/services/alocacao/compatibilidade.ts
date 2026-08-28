import { TipoProduto } from "@prisma/client"
import { projetarCodigoNoDia } from "../jornada.service"
import type { ContextoCompatibilidade, MotoristaParaAlocacao } from "./tipos"

/** Máximo de dias consecutivos de trabalho antes da folga obrigatória — mesmo limite usado pra capar o "Dias Sem Folga" importado do relatório (ver jornada-relatorio.service.ts). */
export const MAX_DIAS_CONSECUTIVOS = 6

function normalizarCliente(cliente: string) {
  return cliente.trim().toUpperCase()
}

/**
 * Dias consecutivos que o motorista ainda pode trabalhar a partir do código
 * informado. Códigos fora de 1-6 (Folga, Férias, Exames, Interno) retornam 0:
 * o motorista só volta a ficar disponível no dia seguinte, quando a rotação
 * o traz de volta ao início do ciclo (ver `jornada.service.ts`).
 */
export function calcularDiasDisponiveis(diasTrabalhados: number) {
  if (diasTrabalhados < 1 || diasTrabalhados > MAX_DIAS_CONSECUTIVOS) {
    return 0
  }

  return MAX_DIAS_CONSECUTIVOS - diasTrabalhados
}

/**
 * `clientesQueExigemIntegracao` já vem normalizado (trim + maiúsculas) — ver
 * buscarNomesClientesQueExigemIntegracao (lib/queries/clientes.ts), que
 * substituiu a antiga lista fixa no código.
 */
export function calcularIntegracaoExigida(
  entregas: Array<{ cliente: string }>,
  clientesQueExigemIntegracao: Set<string>,
) {
  for (const entrega of entregas) {
    const clienteNormalizado = normalizarCliente(entrega.cliente)
    if (clientesQueExigemIntegracao.has(clienteNormalizado)) {
      return clienteNormalizado
    }
  }

  return null
}

function temIntegracaoValida(
  motorista: MotoristaParaAlocacao,
  cliente: string,
  dataInicioViagem: Date,
) {
  const clienteNormalizado = normalizarCliente(cliente)

  return motorista.integracao.some((integracao) => {
    return (
      normalizarCliente(integracao.cliente) === clienteNormalizado &&
      integracao.status === "ATIVO" &&
      new Date(integracao.dataValidade) >= dataInicioViagem
    )
  })
}

/**
 * Código de jornada do motorista projetado para a data real de início da
 * viagem (não o cache de "hoje"). Exportada porque priorizacao.ts também
 * precisa dela pra desempatar por dias disponíveis (ver filtrarMotoristasCompativeis).
 */
export function codigoJornadaNaViagem(motorista: MotoristaParaAlocacao, contexto: ContextoCompatibilidade) {
  return projetarCodigoNoDia(
    motorista.registrosJornada,
    contexto.dataInicioViagem,
    contexto.hoje,
    motorista.diasTrabalhados,
  )
}

/**
 * Bloqueio rígido de produto — mesmo nível de turno acima, não é aviso
 * (comparar com avisoInterjornada/avisoFrotaIndisponivel, que só sinalizam).
 * null/undefined = viagem sem produto definido, sem restrição. Extraída de
 * motoristaEhCompativel pra ser reaplicada no momento de *gravar* a
 * alocação (criar/editar viagem, alocação rápida do dashboard), não só na
 * sugestão — sem isso, dava pra contornar o bloqueio editando a viagem ou
 * alocando manualmente um motorista que a tela de sugestão nunca ofereceria.
 */
export function motoristaAutorizadoParaProduto(
  produtosAutorizados: TipoProduto[],
  produtoExigido?: TipoProduto | null,
): boolean {
  return !produtoExigido || produtosAutorizados.includes(produtoExigido)
}

export function motoristaEhCompativel(
  motorista: MotoristaParaAlocacao,
  contexto: ContextoCompatibilidade,
) {
  if (!motorista.liberado) {
    return false
  }

  if (motorista.turno !== contexto.turnoViagem) {
    return false
  }

  const codigoNaViagem = codigoJornadaNaViagem(motorista, contexto)

  if (calcularDiasDisponiveis(codigoNaViagem) < contexto.diasViagem) {
    return false
  }

  if (!motoristaAutorizadoParaProduto(motorista.produtosAutorizados, contexto.produtoExigido)) {
    return false
  }

  if (!contexto.integracaoExigida) {
    return true
  }

  return temIntegracaoValida(motorista, contexto.integracaoExigida, contexto.dataInicioViagem)
}
