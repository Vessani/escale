import type { TipoProduto } from "@prisma/client"
import { ErroDeDominio } from "@/lib/errors"
import { calcularDescarga, type DadosDescarga } from "@/lib/services/descarga"
import { validarHoraDoRegistro, validarKmDoRegistro } from "@/lib/services/limites-registro"

/**
 * Chegada no cliente: o que vai pro banco, validado e com o total refeito no
 * servidor (nunca o que veio da tela). Usado pelo motorista (registrar) e
 * pelo escalador (corrigir) — as duas telas recusam as mesmas coisas.
 */

export type DadosChegada = Omit<DadosDescarga, "produto"> & { km: number; chegadaEm: Date }

type ViagemDaChegada = { produto: TipoProduto | null; kmInicial: number | null; horarioRealSaida: Date | null }

export function montarRegistroChegada(dados: DadosChegada, viagem: ViagemDaChegada, usuarioId: string | null, agora: Date) {
  validarKmDoRegistro(dados.km, viagem.kmInicial, "Km da chegada")
  validarHoraDoRegistro(dados.chegadaEm, viagem.horarioRealSaida, agora, "chegada")

  const descarga = calcularDescarga({ ...dados, produto: viagem.produto })
  if (!descarga.ok) throw new ErroDeDominio("DESCARGA_INVALIDA", descarga.erro)
  const biometano = viagem.produto === "BIOMETANO"

  return {
    km: dados.km,
    chegadaEm: dados.chegadaEm,
    medicao: descarga.medicao,
    nivelInicial: descarga.nivelInicial,
    nivelFinal: descarga.nivelFinal,
    polInicial: biometano ? (dados.polInicial ?? null) : null,
    polFinal: biometano ? (dados.polFinal ?? null) : null,
    fator: descarga.fator,
    totalDescarregado: descarga.total,
    usuarioId,
  }
}
