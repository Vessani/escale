'use server'
import { revalidatePath } from "next/cache"
import type { RespostaAcao } from "@/lib/types/types"
import { errorToMessage } from "@/lib/action-error"
import { requireSessionComFilial } from "@/lib/auth-guard"
import { atorDaSessao } from "@/lib/services/auditoria.service"
import { manutencaoSchema, type ManutencaoFormValues } from "@/lib/validation/manutencoes"
import { converterEntradaDeDataHora } from "@/lib/utils/date-format"
import { z } from "@/lib/validation/zod"
import {
  concluirManutencaoService,
  criarManutencaoService,
  editarManutencaoService,
  excluirManutencaoService,
  iniciarManutencaoService,
  reabrirManutencaoService,
} from "@/lib/services/manutencao.service"

const idSchema = z.number().int().positive()

function revalidar() {
  revalidatePath("/frotas")
  revalidatePath("/frotas/manutencoes")
}

/** Horário vindo do navegador (datetime-local) ou agora. */
function horario(texto?: string | null): Date {
  return texto ? converterEntradaDeDataHora(texto) : new Date()
}

export async function criarManutencao(dados: ManutencaoFormValues): Promise<RespostaAcao> {
  try {
    const { session, filialId } = await requireSessionComFilial()
    const dadosValidados = manutencaoSchema.parse(dados)

    await criarManutencaoService(filialId, dadosValidados, atorDaSessao(session))
    revalidar()
    return { sucesso: true }
  } catch (erro) {
    return { sucesso: false, erro: errorToMessage(erro, "Erro ao agendar a manutenção.") }
  }
}

export async function editarManutencao(id: number, dados: ManutencaoFormValues): Promise<RespostaAcao> {
  try {
    const { session, filialId } = await requireSessionComFilial()
    const dadosValidados = manutencaoSchema.parse(dados)

    await editarManutencaoService(filialId, idSchema.parse(id), dadosValidados, atorDaSessao(session))
    revalidar()
    return { sucesso: true }
  } catch (erro) {
    return { sucesso: false, erro: errorToMessage(erro, "Erro ao salvar a manutenção.") }
  }
}

export async function iniciarManutencao(id: number, quando?: string | null): Promise<RespostaAcao> {
  try {
    const { session, filialId } = await requireSessionComFilial()
    await iniciarManutencaoService(filialId, idSchema.parse(id), horario(quando), atorDaSessao(session))
    revalidar()
    return { sucesso: true }
  } catch (erro) {
    return { sucesso: false, erro: errorToMessage(erro, "Erro ao registrar o início.") }
  }
}

export async function concluirManutencao(id: number, quando?: string | null): Promise<RespostaAcao> {
  try {
    const { session, filialId } = await requireSessionComFilial()
    await concluirManutencaoService(filialId, idSchema.parse(id), horario(quando), atorDaSessao(session))
    revalidar()
    return { sucesso: true }
  } catch (erro) {
    return { sucesso: false, erro: errorToMessage(erro, "Erro ao concluir a manutenção.") }
  }
}

export async function reabrirManutencao(id: number): Promise<RespostaAcao> {
  try {
    const { session, filialId } = await requireSessionComFilial()
    await reabrirManutencaoService(filialId, idSchema.parse(id), atorDaSessao(session))
    revalidar()
    return { sucesso: true }
  } catch (erro) {
    return { sucesso: false, erro: errorToMessage(erro, "Erro ao reabrir a manutenção.") }
  }
}

export async function excluirManutencao(id: number): Promise<RespostaAcao> {
  try {
    const { session, filialId } = await requireSessionComFilial()
    await excluirManutencaoService(filialId, idSchema.parse(id), atorDaSessao(session))
    revalidar()
    return { sucesso: true }
  } catch (erro) {
    return { sucesso: false, erro: errorToMessage(erro, "Erro ao excluir a manutenção.") }
  }
}
