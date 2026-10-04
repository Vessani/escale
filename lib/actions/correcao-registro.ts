'use server'

import { revalidatePath } from "next/cache"
import { requireSessionComFilial } from "@/lib/auth-guard"
import { errorToMessage } from "@/lib/action-error"
import { atorDaSessao, type Ator } from "@/lib/services/auditoria.service"
import { AREA_MOTORISTA, PAPEIS_ESCALADOR } from "@/lib/papeis"
import {
  apagarChegadaPeloEscalador,
  corrigirDespesaPeloEscalador,
  corrigirKmPeloEscalador,
  lancarDespesaPeloEscalador,
  removerDespesaPeloEscalador,
  salvarChegadaPeloEscalador,
} from "@/lib/services/correcao-registro.service"
import { KM_MAXIMO_HODOMETRO } from "@/lib/services/limites-registro"
import { converterEntradaDeDataHora } from "@/lib/utils/date-format"
import { esquemaChegada, type EntradaChegada } from "@/lib/validation/chegada"
import { z } from "@/lib/validation/zod"
import type { RespostaAcao } from "@/lib/types/types"

/**
 * Escalador corrige o que o motorista registrou (km, pedágio/pernoite,
 * chegadas) — também depois de a viagem encerrar. Regras e histórico em
 * correcao-registro.service.ts.
 */

const id = z.number().int().positive()
const km = z.number().int().min(0).max(KM_MAXIMO_HODOMETRO)
const despesa = z.object({ tipo: z.enum(["PEDAGIO", "PERNOITE"]), valorCentavos: z.number().int() })

async function corrigir(
  mensagemPadrao: string,
  fazer: (filialId: number, ator: Ator) => Promise<{ viagemId: number }>,
): Promise<RespostaAcao> {
  try {
    const { session, filialId } = await requireSessionComFilial(PAPEIS_ESCALADOR)
    const { viagemId } = await fazer(filialId, atorDaSessao(session))
    revalidatePath(`/viagens/editar/${viagemId}`)
    revalidatePath(`/viagens/relatorio/${viagemId}`)
    revalidatePath(AREA_MOTORISTA, "layout")
    return { sucesso: true }
  } catch (erro) {
    return { sucesso: false, erro: errorToMessage(erro, mensagemPadrao) }
  }
}

export async function corrigirKm(viagemId: number, dados: { kmInicial: number; kmFinal: number | null }): Promise<RespostaAcao> {
  return corrigir("Não foi possível corrigir o km.", (filialId, ator) => {
    const entrada = z.object({ viagemId: id, kmInicial: km, kmFinal: km.nullable() }).parse({ ...dados, viagemId })
    return corrigirKmPeloEscalador(filialId, entrada.viagemId, entrada, ator)
  })
}

export async function lancarDespesaEscalador(
  viagemId: number,
  dados: { tipo: "PEDAGIO" | "PERNOITE"; valorCentavos: number },
): Promise<RespostaAcao> {
  return corrigir("Não foi possível lançar a despesa.", (filialId, ator) => {
    const entrada = despesa.extend({ viagemId: id }).parse({ ...dados, viagemId })
    return lancarDespesaPeloEscalador(filialId, entrada.viagemId, entrada, ator)
  })
}

export async function corrigirDespesa(
  despesaId: number,
  dados: { tipo: "PEDAGIO" | "PERNOITE"; valorCentavos: number },
): Promise<RespostaAcao> {
  return corrigir("Não foi possível corrigir a despesa.", (filialId, ator) => {
    const entrada = despesa.extend({ despesaId: id }).parse({ ...dados, despesaId })
    return corrigirDespesaPeloEscalador(filialId, entrada.despesaId, entrada, ator)
  })
}

export async function removerDespesaEscalador(despesaId: number): Promise<RespostaAcao> {
  return corrigir("Não foi possível apagar a despesa.", (filialId, ator) =>
    removerDespesaPeloEscalador(filialId, id.parse(despesaId), ator),
  )
}

export async function salvarChegadaEscalador(entregaId: number, dados: EntradaChegada): Promise<RespostaAcao> {
  return corrigir("Não foi possível salvar a chegada.", (filialId, ator) => {
    const entrada = esquemaChegada.extend({ entregaId: id }).parse({ ...dados, entregaId })
    return salvarChegadaPeloEscalador(
      filialId,
      entrada.entregaId,
      { ...entrada, chegadaEm: converterEntradaDeDataHora(entrada.chegadaEm) },
      ator,
    )
  })
}

/** Escalador apaga uma chegada registrada no cliente errado (fica no histórico). */
export async function apagarChegada(chegadaId: number): Promise<RespostaAcao> {
  return corrigir("Não foi possível apagar a chegada.", (filialId, ator) => apagarChegadaPeloEscalador(filialId, id.parse(chegadaId), ator))
}
