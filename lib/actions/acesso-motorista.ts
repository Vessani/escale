'use server'

import { PAPEIS_ESCALADOR } from "@/lib/papeis"
import { revalidatePath } from "next/cache"
import { requireSessionComFilial } from "@/lib/auth-guard"
import { errorToMessage } from "@/lib/action-error"
import { atorDaSessao } from "@/lib/services/auditoria.service"
import { desativarAcessoMotorista, gerarPinMotorista } from "@/lib/services/acesso-motorista.service"
import { z } from "@/lib/validation/zod"

/** Escalador (admin ou despachante) cria/reseta o acesso — ex: motorista esqueceu o PIN à noite. */
export async function gerarAcessoMotorista(
  motoristaId: number,
): Promise<{ sucesso: true; pin: string; seva: number } | { sucesso: false; erro: string }> {
  try {
    const { session, filialId } = await requireSessionComFilial(PAPEIS_ESCALADOR)
    const resultado = await gerarPinMotorista(filialId, z.number().int().positive().parse(motoristaId), atorDaSessao(session))
    revalidatePath(`/motorista/editar/${motoristaId}`)
    return { sucesso: true, ...resultado }
  } catch (erro) {
    return { sucesso: false, erro: errorToMessage(erro, "Não foi possível gerar o acesso.") }
  }
}

export async function desativarAcesso(motoristaId: number): Promise<{ sucesso: true } | { sucesso: false; erro: string }> {
  try {
    const { session, filialId } = await requireSessionComFilial(PAPEIS_ESCALADOR)
    await desativarAcessoMotorista(filialId, z.number().int().positive().parse(motoristaId), atorDaSessao(session))
    revalidatePath(`/motorista/editar/${motoristaId}`)
    return { sucesso: true }
  } catch (erro) {
    return { sucesso: false, erro: errorToMessage(erro, "Não foi possível desativar o acesso.") }
  }
}
