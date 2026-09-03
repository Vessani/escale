import * as z from "zod"

export const clienteSchema = z.object({
  nome: z.string().min(2, "Nome obrigatório").max(100, "Máximo de 100 caracteres"),
  numeroSap: z
    .string()
    .trim()
    .min(1, "SAP Code obrigatório")
    .max(20, "Máximo de 20 caracteres")
    .regex(/^\d+$/, "SAP Code deve conter apenas dígitos"),
  exigeIntegracao: z.boolean(),
})

export type ClienteFormValues = z.infer<typeof clienteSchema>
