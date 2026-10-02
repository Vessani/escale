import { z } from "@/lib/validation/zod"

export const TAMANHO_MAXIMO_LOCAL = 100
export const TAMANHO_MAXIMO_MOTIVO_TROCA = 200

/** O que a tela manda na troca (escalador ou motorista) — data/hora em ISO. */
export type EntradaTroca = { motoristaNovoId: number; km: number; trocadoEm: string; local: string; motivo: string }

export const esquemaTroca = z.object({
  viagemId: z.number().int().positive(),
  motoristaNovoId: z.number().int().positive(),
  km: z.number().int().min(0).max(9_999_999),
  trocadoEm: z.string().datetime({ offset: true }),
  local: z.string().trim().min(1).max(TAMANHO_MAXIMO_LOCAL),
  motivo: z.string().trim().min(1).max(TAMANHO_MAXIMO_MOTIVO_TROCA),
})
