import { z } from "./zod"

/** Valores mostrados no histórico ("Início", "Dias sem folga"...) — texto curto ou número. */
const resumoSchema = z.record(z.string().max(40), z.union([z.string().max(80), z.number()]))

/**
 * Uma linha do Relatório de Jornada que alguém ajustou na conferência antes
 * de importar — vira um registro no Histórico (antes → depois).
 */
export const ajusteJornadaSchema = z.object({
  matricula: z.number().int().nonnegative(),
  dia: z.string().max(40),
  /** Linha que identifica o ajuste no Histórico (motorista, matrícula, jornada). */
  contexto: z.string().max(160),
  antes: resumoSchema,
  depois: resumoSchema,
})

export const ajustesJornadaSchema = z.array(ajusteJornadaSchema).max(2000)

export type AjusteJornada = z.infer<typeof ajusteJornadaSchema>
