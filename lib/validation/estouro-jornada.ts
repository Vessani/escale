import type { MotivoEstouro } from "@prisma/client"
import { z } from "@/lib/validation/zod"
import {
  LIMITE_MINUTOS_ESTOURO,
  PASSO_MINUTOS_ESTOURO,
  MAXIMO_MOTIVOS_ESTOURO,
  MOTIVOS_ESTOURO,
  TAMANHO_MAXIMO_NOME_DECISOR,
  TAMANHO_MAXIMO_OBSERVACAO_GESTOR,
} from "@/lib/services/estouro-jornada-regras"

/** O que o motorista preenche ao pedir o estouro (ele mesmo é o motorista do pedido). */
export const esquemaSolicitacaoMotorista = z.object({
  viagemId: z.number().int().positive().nullable(),
  minutosExtras: z
    .number({ error: "Escolha as horas extras." })
    .int()
    .positive("Escolha as horas extras.")
    .max(LIMITE_MINUTOS_ESTOURO, "Acima do limite permitido de horas extras.")
    .refine((m) => m % PASSO_MINUTOS_ESTOURO === 0, "Escolha uma das opções de horas extras."),
  motivos: z
    .array(z.enum(MOTIVOS_ESTOURO.map((m) => m.valor) as [MotivoEstouro, ...MotivoEstouro[]]))
    .min(1, "Escolha pelo menos um motivo.")
    .max(MAXIMO_MOTIVOS_ESTOURO, `Escolha no máximo ${MAXIMO_MOTIVOS_ESTOURO} motivos.`)
    .refine((motivos) => new Set(motivos).size === motivos.length, "Motivo repetido."),
})

/** O que o escalador preenche: o mesmo, escolhendo o motorista. */
export const esquemaSolicitacaoEstouro = esquemaSolicitacaoMotorista.extend({
  motoristaId: z.number({ error: "Escolha o motorista." }).int().positive("Escolha o motorista."),
})

export type EntradaSolicitacaoMotorista = z.input<typeof esquemaSolicitacaoMotorista>
export type EntradaSolicitacaoEstouro = z.input<typeof esquemaSolicitacaoEstouro>

/**
 * Token do link: 32 bytes em base64url = 43 caracteres. Validar o formato
 * antes de ir no banco evita consulta com lixo.
 */
export const esquemaTokenEstouro = z.string().regex(/^[A-Za-z0-9_-]{43}$/, "Link inválido.")

export const esquemaDecisaoEstouro = z.object({
  token: esquemaTokenEstouro,
  decisao: z.enum(["APROVADO", "RECUSADO"]),
  nome: z.string().trim().min(2, "Informe seu nome.").max(TAMANHO_MAXIMO_NOME_DECISOR),
  observacao: z.string().trim().max(TAMANHO_MAXIMO_OBSERVACAO_GESTOR).optional(),
})
