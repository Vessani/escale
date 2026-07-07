import * as z from "zod"
import { STATUS_VIAGEM_VALORES } from "@/lib/services/viagem-status.service"

const turnoSchema = z.enum(["MANHA", "NOITE"])
const statusViagemSchema = z.enum(STATUS_VIAGEM_VALORES)

// Limites espelham os tamanhos de coluna definidos em prisma/schema.prisma
// (VarChar), para o erro aparecer no formulário em vez de estourar no banco.
const entregaBaseSchema = z.object({
  dataEntrega: z.string().min(1, "Obrigatorio"),
  cliente: z.string().min(2, "Obrigatorio").max(100, "Máximo de 100 caracteres"),
  cidade: z.string().min(2, "Obrigatorio").max(25, "Máximo de 25 caracteres"),
  uf: z.string().length(2, "Use a sigla"),
  kg: z.coerce.number().min(0),
  m3: z.coerce.number().min(0),
  sapcode: z.string().max(12, "Máximo de 12 caracteres").optional().default(""),
  codewhite: z.string().max(12, "Máximo de 12 caracteres").optional().default(""),
})

export const novaEntregaSchema = entregaBaseSchema.extend({
  obs: z.string().min(2, "Observacao muito curta").max(50, "Máximo de 50 caracteres"),
})

export const editarEntregaSchema = entregaBaseSchema.extend({
  id: z.number().optional(),
  obs: z.string().max(50, "Máximo de 50 caracteres").optional().default(""),
})

const viagemBaseSchema = z.object({
  numViagem: z.string().min(1, "Obrigatorio").max(12, "Máximo de 12 caracteres"),
  carreta: z.string().min(1, "Obrigatorio").max(7, "Máximo de 7 caracteres"),
  cavalo: z.string().min(1, "Obrigatorio").max(7, "Máximo de 7 caracteres"),
  tanque: z.string().min(1, "Obrigatorio").max(10, "Máximo de 10 caracteres"),
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