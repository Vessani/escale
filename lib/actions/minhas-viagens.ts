'use server'

import { revalidatePath } from "next/cache"
import { requireSessaoMotorista } from "@/lib/auth-guard"
import { errorToMessage } from "@/lib/action-error"
import { atorDaSessao } from "@/lib/services/auditoria.service"
import { AREA_MOTORISTA } from "@/lib/papeis"
import {
  adicionarMinhaDespesa,
  encerrarMinhaViagem,
  iniciarMinhaViagem,
  removerMinhaDespesa,
} from "@/lib/services/minhas-viagens.service"
import { z } from "@/lib/validation/zod"
import type { RespostaAcao } from "@/lib/types/types"

const id = z.number().int().positive()
const km = z.number().int().min(0).max(9_999_999)

/** O que o motorista registra muda o Dashboard e as telas de viagem do despacho. */
function revalidarTelas(viagemId?: number) {
  revalidatePath(AREA_MOTORISTA)
  if (viagemId) revalidatePath(`${AREA_MOTORISTA}/${viagemId}`)
  revalidatePath("/")
  revalidatePath("/viagens")
}

async function executar(acao: () => Promise<unknown>, viagemId: number | undefined, fallback: string): Promise<RespostaAcao> {
  try {
    await acao()
    revalidarTelas(viagemId)
    return { sucesso: true }
  } catch (erro) {
    return { sucesso: false, erro: errorToMessage(erro, fallback) }
  }
}

export async function iniciarViagem(viagemId: number, dados: { kmInicial: number; motivoAtraso: string | null }): Promise<RespostaAcao> {
  return executar(async () => {
    const { session, filialId, motoristaId } = await requireSessaoMotorista()
    const entrada = z.object({ viagemId: id, kmInicial: km, motivoAtraso: z.string().max(200).nullable() }).parse({ ...dados, viagemId })
    await iniciarMinhaViagem(filialId, motoristaId, entrada.viagemId, entrada, atorDaSessao(session))
  }, viagemId, "Não foi possível iniciar a viagem.")
}

export async function lancarDespesa(viagemId: number, dados: { tipo: "PEDAGIO" | "PERNOITE"; valorCentavos: number }): Promise<RespostaAcao> {
  return executar(async () => {
    const { session, filialId, motoristaId } = await requireSessaoMotorista()
    const entrada = z
      .object({ viagemId: id, tipo: z.enum(["PEDAGIO", "PERNOITE"]), valorCentavos: z.number().int().positive() })
      .parse({ ...dados, viagemId })
    await adicionarMinhaDespesa(filialId, motoristaId, entrada.viagemId, entrada, atorDaSessao(session))
  }, viagemId, "Não foi possível lançar.")
}

export async function removerDespesa(viagemId: number, despesaId: number): Promise<RespostaAcao> {
  return executar(async () => {
    const { session, filialId, motoristaId } = await requireSessaoMotorista()
    id.parse(viagemId)
    await removerMinhaDespesa(filialId, motoristaId, id.parse(despesaId), atorDaSessao(session))
  }, viagemId, "Não foi possível remover.")
}

export async function encerrarViagem(viagemId: number, dados: { kmFinal: number }): Promise<RespostaAcao> {
  return executar(async () => {
    const { session, filialId, motoristaId } = await requireSessaoMotorista()
    const entrada = z.object({ viagemId: id, kmFinal: km }).parse({ ...dados, viagemId })
    await encerrarMinhaViagem(filialId, motoristaId, entrada.viagemId, entrada, atorDaSessao(session))
  }, viagemId, "Não foi possível encerrar a viagem.")
}
