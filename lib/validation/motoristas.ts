import * as z from "zod"

const turnoSchema = z.enum(["MANHA", "NOITE"])
const statusIntegracaoSchema = z.enum(["ATIVO", "INATIVO", "PENDENTE"])

export const motoristaBaseSchema = z.object({
  nome: z.string().min(2, "O nome deve ter pelo menos 2 caracteres"),
  seva: z.coerce.number().int().min(1, "O numero SEVA deve ser maior que 0"),
  diasTrabalhados: z.coerce.number().int().min(0, "O numero de dias nao pode ser negativo"),
  turno: turnoSchema,
})

export const integracaoMotoristaSchema = z.object({
  id: z.number().optional(),
  cliente: z.string().min(2, "Cliente obrigatorio"),
  dataValidade: z.string().min(1, "Data de validade obrigatoria"),
  status: statusIntegracaoSchema,
})

export const motoristaComIntegracoesSchema = motoristaBaseSchema.extend({
  integracao: z.array(integracaoMotoristaSchema),
})

export type MotoristaFormValues = z.infer<typeof motoristaBaseSchema>
export type MotoristaComIntegracoesFormValues = z.infer<typeof motoristaComIntegracoesSchema>