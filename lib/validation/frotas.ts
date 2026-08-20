import * as z from "zod"
import { PRODUTO_VALORES } from "@/lib/services/produto.service"

// Limites espelham lib/prisma/schema.prisma (Frota.cavalo/carreta @db.VarChar(7))
export const frotaSchema = z.object({
  cavalo: z.string().min(1, "Obrigatório").max(7, "Máximo de 7 caracteres"),
  carreta: z.string().min(1, "Obrigatório").max(7, "Máximo de 7 caracteres"),
  disponivelEm: z.string().optional().nullable(),
  emManutencao: z.boolean(),
  // Um produto só por conjunto (dedicado) — nulo enquanto não definido, nunca obrigatório.
  tipoProduto: z.enum(PRODUTO_VALORES).nullable().optional(),
})

export type FrotaFormValues = z.infer<typeof frotaSchema>
