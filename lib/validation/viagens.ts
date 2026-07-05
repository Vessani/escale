import * as z from "zod"
import { STATUS_VIAGEM_VALORES } from "@/lib/services/viagem-status.service"

const turnoSchema = z.enum(["MANHA", "NOITE"])
const statusViagemSchema = z.enum(STATUS_VIAGEM_VALORES)

const entregaBaseSchema = z.object({
  dataEntrega: z.string().min(1, "Obrigatorio"),
  cliente: z.string().min(2, "Obrigatorio"),
  cidade: z.string().min(2, "Obrigatorio"),
  uf: z.string().length(2, "Use a sigla"),
  kg: z.coerce.number().min(0),
  m3: z.coerce.number().min(0),
  sapcode: z.string().optional().default(""),
  codewhite: z.string().optional().default(""),
})

export const novaEntregaSchema = entregaBaseSchema.extend({
  obs: z.string().min(2, "Observacao muito curta"),
})

export const editarEntregaSchema = entregaBaseSchema.extend({
  id: z.number().optional(),
  obs: z.string().optional().default(""),
})

const viagemBaseSchema = z.object({
  numViagem: z.string().min(1, "Obrigatorio"),
  carreta: z.string().min(1, "Obrigatorio"),
  cavalo: z.string().min(1, "Obrigatorio"),
  tanque: z.string().min(1, "Obrigatorio"),
  diasViagem: z.coerce.number().min(1),
  inicioPrevisto: z.string().min(1, "Obrigatorio"),
  fimPrevisto: z.string().min(1, "Obrigatorio"),
  turno: turnoSchema,
  status: statusViagemSchema.optional(),
})

export const novaViagemSchema = viagemBaseSchema.extend({
  entregas: z.array(novaEntregaSchema).min(1, "A viagem precisa de pelo menos uma entrega."),
})

export const editarViagemSchema = viagemBaseSchema.extend({
  motoristaId: z.number().nullable().optional(),
  entregas: z.array(editarEntregaSchema).min(1, "Minimo de 1 entrega."),
})

export type NovaViagemFormValues = z.infer<typeof novaViagemSchema>
export type EditarViagemFormValues = z.infer<typeof editarViagemSchema>