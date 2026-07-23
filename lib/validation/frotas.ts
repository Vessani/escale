import * as z from "zod"

// Limites espelham lib/prisma/schema.prisma (Frota.cavalo/carreta @db.VarChar(7))
export const frotaSchema = z.object({
  cavalo: z.string().min(1, "Obrigatório").max(7, "Máximo de 7 caracteres"),
  carreta: z.string().min(1, "Obrigatório").max(7, "Máximo de 7 caracteres"),
  disponivelEm: z.string().optional().nullable(),
})

export type FrotaFormValues = z.infer<typeof frotaSchema>
