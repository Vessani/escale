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

/** Período e matrículas que o arquivo importado cobre (ver CoberturaImportacaoJornada). */
export const coberturaJornadaSchema = z.object({
  de: z.string().max(40),
  ate: z.string().max(40),
  matriculas: z.array(z.number().int().nonnegative()).max(2000),
})

/** Data/hora em texto ISO vinda do parser (ex: "2026-10-05T03:00:00.000Z") — tem que ser uma data de verdade. */
const dataTexto = z
  .string()
  .max(40)
  .refine((texto) => !Number.isNaN(new Date(texto).getTime()), "Data inválida no relatório.")

/** Uma jornada do Relatório de Jornada já conferida (ver RegistroJornadaRelatorio). */
const registroJornadaSchema = z.object({
  matricula: z.number().int().nonnegative(),
  nome: z.string().max(120),
  inicioJornada: dataTexto,
  fimJornada: dataTexto,
  dia: dataTexto,
  diasSemFolga: z.number().int().min(0).max(60),
  diasSemFolgaRelatorio: z.number().int().min(0).max(60),
  correcao: z.enum(["BATIDAS_UNIDAS", "BATIDA_EXTRA", "BATIDA_SEM_PAR"]).nullable(),
})

/** Um relatório tem no máximo alguns milhares de linhas (motoristas × dias). */
export const registrosJornadaSchema = z.array(registroJornadaSchema).max(20000)
