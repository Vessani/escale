import * as z from "zod"

export const clienteSchema = z.object({
  nome: z.string().min(2, "Nome obrigatório").max(100, "Máximo de 100 caracteres"),
  exigeIntegracao: z.boolean(),
})

export type ClienteFormValues = z.infer<typeof clienteSchema>
