import * as z from "zod"

const turnoSchema = z.enum(["MANHA", "NOITE"])
const statusIntegracaoSchema = z.enum(["ATIVO", "INATIVO", "PENDENTE"])

export const motoristaBaseSchema = z.object({
  nome: z.string().min(2, "O nome deve ter pelo menos 2 caracteres"),
  seva: z.coerce.number().int().min(1, "O número SEVA deve ser maior que 0"),
  diasTrabalhados: z
    .coerce
    .number()
    .int()
    .min(1, "Informe um código de 1 a 10")
    .max(10, "Informe um código de 1 a 10"),
  turno: turnoSchema,
  liberado: z.boolean(),
})

export const integracaoMotoristaSchema = z.object({
  id: z.number().optional(),
  cliente: z.string().min(2, "Cliente obrigatório"),
  dataValidade: z.string().min(1, "Data de validade obrigatória"),
  status: statusIntegracaoSchema,
})

export const motoristaComIntegracoesSchema = motoristaBaseSchema.extend({
  integracao: z.array(integracaoMotoristaSchema),
})

export type MotoristaComIntegracoesFormValues = z.infer<typeof motoristaComIntegracoesSchema>

// --- Schema de revalidação no servidor ---
// Mesmas regras acima, mas dataValidade também aceita Date: os dois pontos de
// chamada (app/motorista/novo e .../editar) convertem a string do formulário
// pra Date antes de chamar a Server Action.
export const motoristaComIntegracoesServerSchema = motoristaBaseSchema.extend({
  integracao: z.array(
    integracaoMotoristaSchema.extend({
      dataValidade: z.union([z.string().min(1, "Data de validade obrigatória"), z.date()]),
    }),
  ),
})