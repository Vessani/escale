'use server'

import { revalidatePath } from "next/cache"
import { requireSessionComFilial } from "@/lib/auth-guard"
import { errorToMessage } from "@/lib/action-error"
import { atorDaSessao } from "@/lib/services/auditoria.service"
import { AREA_MOTORISTA, PAPEIS_ESCALADOR } from "@/lib/papeis"
import { apagarChegadaPeloEscalador } from "@/lib/services/correcao-registro.service"
import { z } from "@/lib/validation/zod"
import type { RespostaAcao } from "@/lib/types/types"

/** Escalador apaga uma chegada registrada no cliente errado (fica no histórico). */
export async function apagarChegada(chegadaId: number): Promise<RespostaAcao> {
  try {
    const { session, filialId } = await requireSessionComFilial(PAPEIS_ESCALADOR)
    const { viagemId } = await apagarChegadaPeloEscalador(filialId, z.number().int().positive().parse(chegadaId), atorDaSessao(session))
    revalidatePath(`/viagens/editar/${viagemId}`)
    revalidatePath(`/viagens/relatorio/${viagemId}`)
    revalidatePath(AREA_MOTORISTA)
    return { sucesso: true }
  } catch (erro) {
    return { sucesso: false, erro: errorToMessage(erro, "Não foi possível apagar a chegada.") }
  }
}
