"use server"
import { revalidatePath } from "next/cache"
import { requireSession } from "@/lib/auth-guard"
import { errorToMessage } from "@/lib/action-error"
import { ErroDeDominio } from "@/lib/errors"
import { PAPEL_TORRE } from "@/lib/papeis"
import { prisma } from "@/lib/prisma"
import { gravarFilialDaTorre } from "@/lib/torre"
import type { RespostaAcao } from "@/lib/types/types"
import { z } from "@/lib/validation/zod"

/** Troca a filial que a torre está vendo (só ela usa; não grava nada no banco). */
export async function selecionarFilialTorre(filialId: number): Promise<RespostaAcao> {
  try {
    await requireSession([PAPEL_TORRE])
    const id = z.number().int().positive().parse(filialId)
    const filial = await prisma.filial.findUnique({ where: { id }, select: { id: true } })
    if (!filial) throw new ErroDeDominio("FILIAL_NAO_ENCONTRADA", "Filial não encontrada.")
    await gravarFilialDaTorre(filial.id)
    // Todas as telas mostram dados da filial: recarrega a partir do layout.
    revalidatePath("/", "layout")
    return { sucesso: true }
  } catch (erro) {
    return { sucesso: false, erro: errorToMessage(erro, "Não foi possível trocar de filial.") }
  }
}
