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
  turno: "MANHA" | "NOITE"
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
}
