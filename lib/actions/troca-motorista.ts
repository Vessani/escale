"use server"

import { revalidatePath } from "next/cache"
import { requireSessionComFilial } from "@/lib/auth-guard"
import { errorToMessage } from "@/lib/action-error"
import { atorDaSessao } from "@/lib/services/auditoria.service"
import { AREA_MOTORISTA, PAPEIS_ESCALADOR } from "@/lib/papeis"
import { trocarMotoristaDaViagem } from "@/lib/services/troca-motorista.service"
import { converterEntradaDeDataHora } from "@/lib/utils/date-format"
import { esquemaTroca, type EntradaTroca } from "@/lib/validation/troca-motorista"
import type { RespostaAcao } from "@/lib/types/types"

/** Escalador troca o motorista de uma viagem em andamento. */
export async function trocarMotorista(viagemId: number, dados: EntradaTroca): Promise<RespostaAcao> {
  try {
    const { session, filialId } = await requireSessionComFilial(PAPEIS_ESCALADOR)
    const entrada = esquemaTroca.parse({ ...dados, viagemId })
    await trocarMotoristaDaViagem(
      filialId,
      entrada.viagemId,
      { ...entrada, trocadoEm: converterEntradaDeDataHora(entrada.trocadoEm) },
      atorDaSessao(session),
    )
    revalidatePath("/")
    revalidatePath("/viagens")
    revalidatePath(`/viagens/editar/${entrada.viagemId}`)
    revalidatePath(AREA_MOTORISTA)
    return { sucesso: true }
  } catch (erro) {
    return { sucesso: false, erro: errorToMessage(erro, "Não foi possível trocar o motorista.") }
  }
}
