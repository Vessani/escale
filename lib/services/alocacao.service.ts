import { StatusIntegracao, Turno } from "@prisma/client"

const MAX_DIAS_CONSECUTIVOS = 6

const CLIENTES_COM_INTEGRACAO_OBRIGATORIA = new Set([
  "AMBEV",
  "WEG",
])

type IntegracaoBase = {
  cliente: string
  status: StatusIntegracao
  dataValidade: Date | string
}

type MotoristaParaAlocacao = {
  id: number
  nome: string
  turno: Turno
  diasTrabalhados: number
  integracao: IntegracaoBase[]
}

type ContextoCompatibilidade = {
  turnoViagem: Turno
  diasViagem: number
  dataInicioViagem: Date
  integracaoExigida: string | null
}

function normalizarCliente(cliente: string) {
  return cliente.trim().toUpperCase()
}

export function calcularDiasDisponiveis(diasTrabalhados: number) {
  if (diasTrabalhados < 1 || diasTrabalhados > MAX_DIAS_CONSECUTIVOS) {
    return 0
  }

  return MAX_DIAS_CONSECUTIVOS - diasTrabalhados
}

export function calcularIntegracaoExigida(entregas: Array<{ cliente: string }>) {
  for (const entrega of entregas) {
    const clienteNormalizado = normalizarCliente(entrega.cliente)
    if (CLIENTES_COM_INTEGRACAO_OBRIGATORIA.has(clienteNormalizado)) {
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

export function motoristaEhCompativel(
  motorista: MotoristaParaAlocacao,
  contexto: ContextoCompatibilidade,
) {
  if (motorista.turno !== contexto.turnoViagem) {
    return false
  }

  if (calcularDiasDisponiveis(motorista.diasTrabalhados) < contexto.diasViagem) {
    return false
  }

  if (!contexto.integracaoExigida) {
    return true
  }

  return temIntegracaoValida(motorista, contexto.integracaoExigida, contexto.dataInicioViagem)
}

export function filtrarMotoristasCompativeis(
  motoristas: MotoristaParaAlocacao[],
  contexto: ContextoCompatibilidade,
) {
  return motoristas
    .filter((motorista) => motoristaEhCompativel(motorista, contexto))
    .sort((a, b) => {
      const diasDisponiveisA = calcularDiasDisponiveis(a.diasTrabalhados)
      const diasDisponiveisB = calcularDiasDisponiveis(b.diasTrabalhados)
      return diasDisponiveisB - diasDisponiveisA || a.nome.localeCompare(b.nome)
    })
}

export function sugerirMotoristaAutomatico(
  motoristas: MotoristaParaAlocacao[],
  contexto: ContextoCompatibilidade,
) {
  const compativeis = filtrarMotoristasCompativeis(motoristas, contexto)
  return compativeis[0] ?? null
}
