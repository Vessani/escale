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
  if (diasTrabalhados === 7) {
    return MAX_DIAS_CONSECUTIVOS
  }

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

export function filtrarMotoristasCompativeis<T extends MotoristaParaAlocacao>(
  motoristas: T[],
  contexto: ContextoCompatibilidade,
): T[] {
  return motoristas
    .filter((motorista) => motoristaEhCompativel(motorista, contexto))
    .sort((a, b) => {
      const diasDisponiveisA = calcularDiasDisponiveis(a.diasTrabalhados)
      const diasDisponiveisB = calcularDiasDisponiveis(b.diasTrabalhados)
      return diasDisponiveisB - diasDisponiveisA || a.nome.localeCompare(b.nome)
    })
}

export function periodoConflita(inicioA: Date, fimA: Date, inicioB: Date, fimB: Date) {
  return inicioA < fimB && fimA > inicioB
}

function viagemBloqueiaAgenda(viagem: ViagemParaDisponibilidade) {
  if (viagem.deletadoEm) {
    return false
  }

  return viagem.status !== "CANCELADA" && viagem.status !== "FINALIZADA"
}

function inicioDoDiaLocal(data: Date): Date {
  const dia = new Date(data)
  dia.setHours(0, 0, 0, 0)
  return dia
}

/** Primeiro dia (00:00) em que o motorista está livre após o fim de uma viagem: o dia seguinte ao dia em que ela termina. */
function primeiroDiaDisponivelApos(fimViagem: Date): Date {
  const dia = inicioDoDiaLocal(fimViagem)
  dia.setDate(dia.getDate() + 1)
  return dia
}

/**
 * Duas viagens conflitam por descanso se, olhando só a data (não a hora exata),
 * uma delas começa antes do primeiro dia livre após o fim da outra — ou seja,
 * exige pelo menos um dia calendário inteiro de descanso entre o fim de uma
 * viagem e o início da próxima. Ex: viagem termina dia 9, só libera dia 10.
 */
export function periodosConflitamComDescanso(inicioA: Date, fimA: Date, inicioB: Date, fimB: Date) {
  return periodoConflita(
    inicioDoDiaLocal(inicioA),
    primeiroDiaDisponivelApos(fimA),
    inicioDoDiaLocal(inicioB),
    primeiroDiaDisponivelApos(fimB),
  )
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

    return periodosConflitamComDescanso(
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

type ViagemParaSugestaoLote = {
  id: number
  turno: Turno
  diasViagem: number
  inicioPrevisto: Date
  fimPrevisto: Date
  integracaoExigida: string | null
}

type AtribuicaoTentativa = {
  motoristaId: number
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
): SugestaoAlocacaoLote[] {
  const atribuicoesTentativas: AtribuicaoTentativa[] = []

  return viagens.map((viagem) => {
    const contexto: ContextoCompatibilidade = {
      turnoViagem: viagem.turno,
      diasViagem: viagem.diasViagem,
      dataInicioViagem: viagem.inicioPrevisto,
      integracaoExigida: viagem.integracaoExigida,
    }

    const motoristasDisponiveis = filtrarMotoristasDisponiveisNoPeriodo(
      motoristas,
      viagem.inicioPrevisto,
      viagem.fimPrevisto,
    )

    const motoristasCompativeis = filtrarMotoristasCompativeis(motoristasDisponiveis, contexto).filter(
      (motorista) =>
        !atribuicoesTentativas.some(
          (atribuicao) =>
            atribuicao.motoristaId === motorista.id &&
            periodosConflitamComDescanso(viagem.inicioPrevisto, viagem.fimPrevisto, atribuicao.inicio, atribuicao.fim),
        ),
    )

    // motoristasCompativeis já está filtrado e ordenado por filtrarMotoristasCompativeis
    // (mesmo critério usado por sugerirMotoristaAutomatico); o primeiro é o sugerido.
    const motoristaSugerido = motoristasCompativeis[0] ?? null

    if (motoristaSugerido) {
      atribuicoesTentativas.push({
        motoristaId: motoristaSugerido.id,
        inicio: viagem.inicioPrevisto,
        fim: viagem.fimPrevisto,
      })
    }

    return { viagemId: viagem.id, motoristasCompativeis, motoristaSugerido }
  })
}
