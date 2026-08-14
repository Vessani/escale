import * as z from "zod"

export const filialSchema = z.object({
  nome: z.string().min(2, "Nome obrigatório").max(100, "Máximo de 100 caracteres"),
})

export type FilialFormValues = z.infer<typeof filialSchema>
