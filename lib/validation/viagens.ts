import { Turno } from "@prisma/client"
import * as z from "zod"

const entregaBaseSchema = z.object({
  dataEntrega: z.string().min(1, "Obrigatório"),
  cliente: z.string().min(2, "Obrigatório"),
  cidade: z.string().min(2, "Obrigatório"),
  uf: z.string().length(2, "Use a sigla"),
  kg: z.coerce.number().min(0),
  m3: z.coerce.number().min(0),
  sapcode: z.string().optional().default(""),
  codewhite: z.string().optional().default(""),
})

export const novaEntregaSchema = entregaBaseSchema.extend({
  obs: z.string().min(2, "Observação muito curta"),
})

export const editarEntregaSchema = entregaBaseSchema.extend({
  id: z.number().optional(),
  obs: z.string().optional().default(""),
})

const viagemBaseSchema = z.object({
  numViagem: z.string().min(1, "Obrigatório"),
  carreta: z.string().min(1, "Obrigatório"),
  cavalo: z.string().min(1, "Obrigatório"),
  tanque: z.string().min(1, "Obrigatório"),
  diasViagem: z.coerce.number().min(1),
  inicioPrevisto: z.string().min(1, "Obrigatório"),
  fimPrevisto: z.string().min(1, "Obrigatório"),
  turno: z.nativeEnum(Turno),
})

export const novaViagemSchema = viagemBaseSchema.extend({
  entregas: z.array(novaEntregaSchema).min(1, "A viagem precisa de pelo menos uma entrega."),
})

export const editarViagemSchema = viagemBaseSchema.extend({
  motoristaId: z.number().nullable().optional(),
  entregas: z.array(editarEntregaSchema).min(1, "Mínimo de 1 entrega."),
})

export type NovaViagemFormValues = z.infer<typeof novaViagemSchema>
export type EditarViagemFormValues = z.infer<typeof editarViagemSchema>
