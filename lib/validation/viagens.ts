import * as z from "zod"
import { STATUS_VIAGEM_VALORES } from "@/lib/services/viagem-status.service"
import { PRODUTO_VALORES } from "@/lib/services/produto.service"

const turnoSchema = z.enum(["MANHA", "NOITE"])
const statusViagemSchema = z.enum(STATUS_VIAGEM_VALORES)
const produtoSchema = z.enum(PRODUTO_VALORES)

const MENSAGEM_PERIODO_INVALIDO = "A data de término não pode ser antes da data de início."

/** Converte pra Date sem cair no overload do construtor que só aceita string|number. */
function paraData(valor: string | Date): Date {
  return valor instanceof Date ? valor : new Date(valor)
}

function periodoValido(dados: { inicioPrevisto: string | Date; fimPrevisto: string | Date }) {
  return paraData(dados.fimPrevisto).getTime() >= paraData(dados.inicioPrevisto).getTime()
}

// Limites espelham os tamanhos de coluna definidos em prisma/schema.prisma
// (VarChar), para o erro aparecer no formulário em vez de estourar no banco.
const entregaBaseSchema = z.object({
  dataEntrega: z.string().min(1, "Obrigatório"),
  cliente: z.string().min(2, "Obrigatório").max(100, "Máximo de 100 caracteres"),
  cidade: z.string().min(2, "Obrigatório").max(25, "Máximo de 25 caracteres"),
  uf: z.string().length(2, "Use a sigla"),
  kg: z.coerce.number().min(0),
  m3: z.coerce.number().min(0),
  sapcode: z.string().max(12, "Máximo de 12 caracteres").optional().default(""),
  codewhite: z.string().max(12, "Máximo de 12 caracteres").optional().default(""),
})

export const novaEntregaSchema = entregaBaseSchema.extend({
  obs: z.string().min(2, "Observação muito curta").max(50, "Máximo de 50 caracteres"),
})

export const editarEntregaSchema = entregaBaseSchema.extend({
  id: z.number().optional(),
  obs: z.string().max(50, "Máximo de 50 caracteres").optional().default(""),
})

const viagemBaseSchema = z.object({
  numViagem: z.string().min(1, "Obrigatório").max(12, "Máximo de 12 caracteres"),
  carreta: z.string().min(1, "Obrigatório").max(7, "Máximo de 7 caracteres"),
  cavalo: z.string().min(1, "Obrigatório").max(7, "Máximo de 7 caracteres"),
  tanque: z.string().min(1, "Obrigatório").max(10, "Máximo de 10 caracteres"),
  diasViagem: z.coerce.number().min(1),
  inicioPrevisto: z.string().min(1, "Obrigatório"),
  fimPrevisto: z.string().min(1, "Obrigatório"),
  turno: turnoSchema,
  // Obrigatório em toda viagem nova/editada a partir de agora — mesmo que a
  // coluna no banco seja nula pra não quebrar viagens já existentes (ver
  // Viagem.produto no schema).
  produto: produtoSchema,
  status: statusViagemSchema.optional(),
  viagemExtra: z.boolean().optional().default(false),
})

export const novaViagemSchema = viagemBaseSchema
  .extend({
    entregas: z.array(novaEntregaSchema).min(1, "A viagem precisa de pelo menos uma entrega."),
  })
  .refine(periodoValido, { message: MENSAGEM_PERIODO_INVALIDO, path: ["fimPrevisto"] })

export const editarViagemSchema = viagemBaseSchema
  .extend({
    motoristaId: z.number().nullable().optional(),
    motoristaAcompanhanteId: z.number().nullable().optional(),
    entregas: z.array(editarEntregaSchema).min(1, "A viagem precisa de pelo menos uma entrega."),
  })
  .refine(periodoValido, { message: MENSAGEM_PERIODO_INVALIDO, path: ["fimPrevisto"] })

export type NovaViagemFormValues = z.infer<typeof novaViagemSchema>
export type EditarViagemFormValues = z.infer<typeof editarViagemSchema>

// --- Schemas de revalidação no servidor ---
// Mesmas regras acima, mas aceitando Date além de string nos campos de data:
// diferente do formulário (sempre string, vindo de <input type="datetime-local">),
// alguns fluxos convertem pra Date antes de chamar a Server Action (ver
// app/viagens/editar/[id]/form-editar.tsx e viagens-alocacao-client.tsx).
const dataFlexivel = (mensagem = "Obrigatório") => z.union([z.string().min(1, mensagem), z.date()])

const entregaServerSchema = z.object({
  id: z.number().optional(),
  dataEntrega: dataFlexivel(),
  cliente: z.string().min(2, "Obrigatório").max(100, "Máximo de 100 caracteres"),
  cidade: z.string().min(2, "Obrigatório").max(25, "Máximo de 25 caracteres"),
  uf: z.string().length(2, "Use a sigla"),
  kg: z.coerce.number().min(0),
  m3: z.coerce.number().min(0),
  sapcode: z.string().max(12, "Máximo de 12 caracteres").optional().default(""),
  codewhite: z.string().max(12, "Máximo de 12 caracteres").optional().default(""),
  obs: z.string().max(50, "Máximo de 50 caracteres").optional().default(""),
})

export const editarViagemServerSchema = z
  .object({
    numViagem: z.string().min(1, "Obrigatório").max(12, "Máximo de 12 caracteres"),
    carreta: z.string().min(1, "Obrigatório").max(7, "Máximo de 7 caracteres"),
    cavalo: z.string().min(1, "Obrigatório").max(7, "Máximo de 7 caracteres"),
    tanque: z.string().min(1, "Obrigatório").max(10, "Máximo de 10 caracteres"),
    diasViagem: z.coerce.number().min(1),
    inicioPrevisto: dataFlexivel(),
    fimPrevisto: dataFlexivel(),
    turno: turnoSchema,
    produto: produtoSchema,
    status: statusViagemSchema.optional(),
    viagemExtra: z.boolean().optional().default(false),
    motoristaId: z.number().nullable().optional(),
    motoristaAcompanhanteId: z.number().nullable().optional(),
    entregas: z.array(entregaServerSchema).min(1, "A viagem precisa de pelo menos uma entrega."),
  })
  .refine(periodoValido, { message: MENSAGEM_PERIODO_INVALIDO, path: ["fimPrevisto"] })
