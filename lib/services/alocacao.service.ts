import { StatusIntegracao, StatusViagem, Turno } from "@prisma/client"

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

type ViagemParaDisponibilidade = {
  id: number
  inicioPrevisto: Date | string
  fimPrevisto: Date | string
  status: StatusViagem
  deletadoEm?: Date | string | null
}

type MotoristaComAgenda = MotoristaParaAlocacao & {
  viagens: ViagemParaDisponibilidade[]
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

function periodoConflita(inicioA: Date, fimA: Date, inicioB: Date, fimB: Date) {
  return inicioA < fimB && fimA > inicioB
}

function viagemBloqueiaAgenda(viagem: ViagemParaDisponibilidade) {
  if (viagem.deletadoEm) {
    return false
  }

  return viagem.status !== "CANCELADA" && viagem.status !== "FINALIZADA"
}

export function motoristaEstaDisponivelNoPeriodo(
  motorista: MotoristaComAgenda,
  inicioViagem: Date,
  fimViagem: Date,
) {
  return !motorista.viagens.some((viagem) => {
    if (!viagemBloqueiaAgenda(viagem)) {
      return false
    }

    return periodoConflita(
      new Date(viagem.inicioPrevisto),
      new Date(viagem.fimPrevisto),
      inicioViagem,
      fimViagem,
    )
  })
}

export function filtrarMotoristasDisponiveisNoPeriodo(
  motoristas: MotoristaComAgenda[],
  inicioViagem: Date,
  fimViagem: Date,
) {
  return motoristas.filter((motorista) =>
    motoristaEstaDisponivelNoPeriodo(motorista, inicioViagem, fimViagem),
  )
}

export function sugerirMotoristaAutomatico(
  motoristas: MotoristaParaAlocacao[],
  contexto: ContextoCompatibilidade,
) {
  const compativeis = filtrarMotoristasCompativeis(motoristas, contexto)
  return compativeis[0] ?? null
}
