import { TipoProduto } from "@prisma/client"
import { colunaDateParaLocal, fimDoDia } from "@/lib/utils/date-format"
import { projetarCodigoNoDia } from "../jornada.service"
import type { ContextoCompatibilidade, MotoristaParaAlocacao } from "./tipos"
import { podeSerPrincipal } from "../tipo-motorista"
import { MAX_DIAS_SEM_FOLGA } from "../dias-sem-folga"

/** Máximo de dias consecutivos de trabalho antes da folga obrigatória — mesmo limite usado pra capar o "Dias Sem Folga" importado do relatório (ver jornada-relatorio.service.ts). */
export const MAX_DIAS_CONSECUTIVOS = MAX_DIAS_SEM_FOLGA

function normalizarCliente(cliente: string) {
  return cliente.trim().toUpperCase()
}

/**
 * Número de dias de viagem (contagem INCLUSIVA — mesma escala de
 * `calcularDiasEntre`: uma viagem que começa e termina no mesmo dia é 1) que
 * o motorista ainda pode assumir a partir do código informado, sem invadir a
 * folga. No 6º dia o motorista ainda trabalha, então cabe uma viagem de 1 dia
 * que termina nesse mesmo 6º dia → retorna 1. No 5º dia cabem 2 dias (5º + 6º),
 * e assim por diante; qualquer viagem que estenda além do 6º dia é barrada por
 * `motoristaEhCompativel`. Códigos fora de 1-6 (Folga, Férias, Exames,
 * Interno) retornam 0: o motorista só volta a ficar disponível no dia
 * seguinte, quando a rotação o traz de volta ao início do ciclo (ver
 * `jornada.service.ts`).
 */
export function calcularDiasDisponiveis(diasTrabalhados: number) {
  if (diasTrabalhados < 1 || diasTrabalhados > MAX_DIAS_CONSECUTIVOS) {
    return 0
  }

  return MAX_DIAS_CONSECUTIVOS - diasTrabalhados + 1
}

/**
 * `numerosSapQueExigemIntegracao` é o conjunto de numeroSap dos clientes com
 * exigeIntegracao: true — ver buscarNumerosSapQueExigemIntegracao
 * (lib/queries/clientes.ts), que substituiu a antiga lista fixa no código.
 * O casamento com a entrega é pelo SAP Code (Entrega.sapcode), não pelo nome
 * do cliente: o nome é digitado de forma inconsistente, o SAP Code é a chave
 * estável que também identifica o cliente no cadastro (Cliente.numeroSap).
 * O valor retornado — gravado em Viagem.integracaoExigida — é o próprio SAP
 * Code encontrado.
 */
export function calcularIntegracaoExigida(
  entregas: Array<{ sapcode: string }>,
  numerosSapQueExigemIntegracao: Set<string>,
) {
  for (const entrega of entregas) {
    const sapCode = entrega.sapcode.trim()
    if (sapCode && numerosSapQueExigemIntegracao.has(sapCode)) {
      return sapCode
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
    const validade = new Date(integracao.dataValidade)
    const fimValidadeBrasilia = fimDoDia(colunaDateParaLocal(validade))

    return (
      normalizarCliente(integracao.cliente) === clienteNormalizado &&
      integracao.status === "ATIVO" &&
      fimValidadeBrasilia >= dataInicioViagem
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
  // Em treinamento/enchedor nunca vão como principal (ver tipo-motorista.ts).
  // Instrutor e interno PODEM — só não entram na sugestão automática, filtro
  // aplicado em filtrarMotoristasCompativeis, não aqui: esta função também
  // responde "cabe na regra?" pra escolha manual (Dashboard, edição).
  if (!podeSerPrincipal(motorista.tipo)) {
    return false
  }

  if (motorista.turno !== contexto.turnoViagem) {
    return false
  }

  const codigoNaViagem = codigoJornadaNaViagem(motorista, contexto)

  if (calcularDiasDisponiveis(codigoNaViagem) < contexto.diasViagem) {
    return false
  }

  // Garante que a viagem inteira cabe dentro do ciclo de trabalho: mesmo com
  // diasViagem consistente, o caminho de gravação manual (alocação de
  // emergência) reaplica esta função com um contexto montado à mão, onde
  // diasViagem pode não bater com o intervalo real. Usa o fim real da viagem
  // (ou o fim estimado desde a data de início) para projetar o código de
  // jornada no último dia calendário coberto — o motorista pode iniciar no 6º
  // dia, mas nunca terminar no 7º (folga obrigatória).
  const fimViagem = contexto.fimViagem ?? new Date(
    contexto.dataInicioViagem.getTime() + Math.max(contexto.diasViagem - 1, 0) * 24 * 60 * 60 * 1000,
  )
  const codigoNoUltimoDia = projetarCodigoNoDia(
    motorista.registrosJornada,
    fimViagem,
    contexto.hoje,
    motorista.diasTrabalhados,
  )
  if (codigoNoUltimoDia > MAX_DIAS_CONSECUTIVOS) {
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
