"use server"
import { revalidatePath } from "next/cache"
import { type RespostaAcao } from "@/lib/types/types"
import { errorToMessage } from "@/lib/action-error"
import { requireSessionComFilial } from "@/lib/auth-guard"
import { frotaSchema, type FrotaFormValues } from "@/lib/validation/frotas"
import { atorDaSessao } from "@/lib/services/auditoria.service"
import { criarFrotaService, editarFrotaService, deletarFrotaService } from "@/lib/services/frota.service"

export async function criarFrota(dados: FrotaFormValues): Promise<RespostaAcao> {
  try {
    const { session, filialId } = await requireSessionComFilial()

    const dadosValidados = frotaSchema.parse(dados)

    await criarFrotaService(filialId, dadosValidados, atorDaSessao(session))

    revalidatePath("/frotas")
    return { sucesso: true }
  } catch (error) {
    return { sucesso: false, erro: errorToMessage(error, "Erro ao criar conjunto.") }
  }
}

export async function editarFrota(id: number, dados: FrotaFormValues): Promise<RespostaAcao> {
  try {
    const { session, filialId } = await requireSessionComFilial()

    const dadosValidados = frotaSchema.parse(dados)

    await editarFrotaService(filialId, id, dadosValidados, atorDaSessao(session))

    revalidatePath("/frotas")
    return { sucesso: true }
  } catch (error) {
    return { sucesso: false, erro: errorToMessage(error, "Erro ao editar conjunto.") }
  }
}

export async function deletarFrota(id: number): Promise<RespostaAcao> {
  try {
    const { session, filialId } = await requireSessionComFilial(["ADMIN"])
    await deletarFrotaService(filialId, id, atorDaSessao(session))

    revalidatePath("/frotas")
    return { sucesso: true }
  } catch (error) {
    return { sucesso: false, erro: errorToMessage(error, "Erro ao deletar conjunto.") }
  }
}
