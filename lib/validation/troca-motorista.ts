import { z } from "@/lib/validation/zod"
import { KM_MAXIMO_HODOMETRO } from "@/lib/services/limites-registro"

/** Valor de <input type="datetime-local"> ("YYYY-MM-DDTHH:MM"), horário de Brasília — converter com converterEntradaDeDataHora. */
export const DATA_HORA_DO_CAMPO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/

export const TAMANHO_MAXIMO_LOCAL = 100
export const TAMANHO_MAXIMO_MOTIVO_TROCA = 200

/** O que a tela manda na troca (escalador ou motorista) — data/hora como vem do campo ("YYYY-MM-DDTHH:MM", horário de Brasília). */
export type EntradaTroca = { motoristaNovoId: number; km: number; trocadoEm: string; local: string; motivo: string }

export const esquemaTroca = z.object({
  viagemId: z.number().int().positive(),
  motoristaNovoId: z.number().int().positive(),
  km: z.number().int().min(0).max(KM_MAXIMO_HODOMETRO),
  trocadoEm: z.string().regex(DATA_HORA_DO_CAMPO, "Data e hora inválidas."),
  local: z.string().trim().min(1).max(TAMANHO_MAXIMO_LOCAL),
  motivo: z.string().trim().min(1).max(TAMANHO_MAXIMO_MOTIVO_TROCA),
})
