import { StatusIntegracao, Turno } from "@prisma/client"
import * as z from "zod"

export const motoristaBaseSchema = z.object({
  nome: z.string().min(2, "O nome deve ter pelo menos 2 caracteres"),
  seva: z.coerce.number().int().min(1, "O número SEVA deve ser maior que 0"),
  diasTrabalhados: z.coerce.number().int().min(0, "O número de dias não pode ser negativo"),
  turno: z.nativeEnum(Turno),
})

export const integracaoMotoristaSchema = z.object({
  id: z.number().optional(),
  cliente: z.string().min(2, "Cliente obrigatório"),
  dataValidade: z.string().min(1, "Data de validade obrigatória"),
  status: z.nativeEnum(StatusIntegracao),
})

export const motoristaComIntegracoesSchema = motoristaBaseSchema.extend({
  integracao: z.array(integracaoMotoristaSchema),
})

export type MotoristaFormValues = z.infer<typeof motoristaBaseSchema>
export type MotoristaComIntegracoesFormValues = z.infer<typeof motoristaComIntegracoesSchema>
