import { z } from "@/lib/validation/zod"
import { TAMANHO_MAXIMO_NOME_DECISOR, TAMANHO_MAXIMO_OBSERVACAO_GESTOR } from "@/lib/services/link-aprovacao-regras"

/**
 * Token do link: 32 bytes em base64url = 43 caracteres. Validar o formato
 * antes de ir no banco evita consulta com lixo.
 */
export const esquemaTokenLink = z.string().regex(/^[A-Za-z0-9_-]{43}$/, "Link inválido.")

/** O que a página pública manda ao decidir — igual pra todo tipo de pedido. */
export const esquemaDecisaoLink = z.object({
  token: esquemaTokenLink,
  decisao: z.enum(["APROVADO", "RECUSADO"]),
  nome: z.string().trim().min(2, "Informe seu nome.").max(TAMANHO_MAXIMO_NOME_DECISOR),
  observacao: z.string().trim().max(TAMANHO_MAXIMO_OBSERVACAO_GESTOR).optional(),
})

export type EntradaDecisaoLink = z.input<typeof esquemaDecisaoLink>
