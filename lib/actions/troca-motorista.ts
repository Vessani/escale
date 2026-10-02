'use server'

import { revalidatePath } from "next/cache"
import { requireSessionComFilial } from "@/lib/auth-guard"
import { errorToMessage } from "@/lib/action-error"
import { atorDaSessao } from "@/lib/services/auditoria.service"
import { AREA_MOTORISTA } from "@/lib/papeis"
import { trocarMotoristaDaViagem } from "@/lib/services/troca-motorista.service"
import { esquemaTroca, type EntradaTroca } from "@/lib/validation/troca-motorista"
import type { RespostaAcao } from "@/lib/types/types"

const PAPEIS_ESCALADOR = ["ADMIN", "DESPACHANTE"]

/** Escalador troca o motorista de uma viagem em andamento. */
export async function trocarMotorista(viagemId: number, dados: EntradaTroca): Promise<RespostaAcao> {
  try {
    const { session, filialId } = await requireSessionComFilial(PAPEIS_ESCALADOR)
    const entrada = esquemaTroca.parse({ ...dados, viagemId })
    await trocarMotoristaDaViagem(filialId, entrada.viagemId, { ...entrada, trocadoEm: new Date(entrada.trocadoEm) }, atorDaSessao(session))
    revalidatePath("/")
    revalidatePath("/viagens")
    revalidatePath(`/viagens/editar/${entrada.viagemId}`)
    revalidatePath(AREA_MOTORISTA)
    return { sucesso: true }
  } catch (erro) {
    return { sucesso: false, erro: errorToMessage(erro, "Não foi possível trocar o motorista.") }
  }
}
