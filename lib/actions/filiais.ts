"use server"
import { revalidatePath } from "next/cache"
import { requireSession } from "@/lib/auth-guard"
import { errorToMessage } from "@/lib/action-error"
import { filialSchema, type FilialFormValues } from "@/lib/validation/filiais"
import type { RespostaAcao } from "@/lib/types/types"
import { atorDaSessao } from "@/lib/services/auditoria.service"
import { criarFilialService } from "@/lib/services/filial.service"

export async function criarFilial(dados: FilialFormValues): Promise<RespostaAcao> {
  try {
    const session = await requireSession(["SUPERADMIN"])
    await criarFilialService(filialSchema.parse(dados), atorDaSessao(session))
    revalidatePath("/admin/filiais")
    return { sucesso: true }
  } catch (erro) {
    return { sucesso: false, erro: errorToMessage(erro, "Erro ao criar filial.") }
  }
}
