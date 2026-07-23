export type EntregaAlocacao = {
  id: number
  dataEntrega: string
  cliente: string
  cidade: string
  uf: string
  kg: number
  m3: number
  obs: string
  sapcode: string
  codewhite: string
}

export type MotoristaCompativel = {
  id: number
  nome: string
  diasTrabalhados: number
  diasDisponiveis: number
  turno: "MANHA" | "NOITE"
  /** Hora do dia do último "Início de Jornada" do relatório importado, ex: "07:00". `null` sem dado. */
  horarioHabitual: string | null
  /** Horário mínimo do próximo início respeitando o descanso legal, ex: "06:00". `null` sem dado. */
  proximoInicioDisponivel: string | null
}

export type MotoristaSugerido = {
  id: number
  nome: string
} | null

export type ViagemAlocacao = {
  id: number
  numViagem: string
  carreta: string
  cavalo: string
  tanque: string
  diasViagem: number
  inicioPrevisto: string
  fimPrevisto: string
  turno: "MANHA" | "NOITE"
  motoristaId: number | null
  integracaoExigida: string | null
  entregas: EntregaAlocacao[]
  motoristaSugerido: MotoristaSugerido
  motoristasCompativeis: MotoristaCompativel[]
  avisoInterjornada: string | null
  /** Ver calcularAvisoFrotaIndisponivel (frota.service.ts) — cavalo/carreta em uso em outra viagem no mesmo período. */
  avisoFrotaIndisponivel: string | null
}

/** Sugestão de alocação para uma viagem que ainda não existe no banco (revisão antes de criar em lote). */
export type SugestaoAlocacaoPendente = {
  numViagem: string
  motoristaSugerido: MotoristaSugerido
  motoristasCompativeis: MotoristaCompativel[]
  /** Calculado pro motorista sugerido — ver calcularAvisoInterjornada (alocacao.service.ts). */
  avisoInterjornada: string | null
  /** Ver calcularAvisoFrotaIndisponivel (frota.service.ts) — cavalo/carreta em uso em outra viagem no mesmo período. */
  avisoFrotaIndisponivel: string | null
}
