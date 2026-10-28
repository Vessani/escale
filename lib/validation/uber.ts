import type { MotivoUber } from "@prisma/client"
import { z } from "@/lib/validation/zod"
import { MOTIVOS_UBER, TAMANHO_MAXIMO_LOCAL_UBER } from "@/lib/services/uber-regras"

const local = (campo: string) =>
  z
    .string()
    .trim()
    .min(3, `Informe ${campo}.`)
    .max(TAMANHO_MAXIMO_LOCAL_UBER, `${campo.charAt(0).toUpperCase()}${campo.slice(1)}: no máximo ${TAMANHO_MAXIMO_LOCAL_UBER} caracteres.`)

/** O que o motorista preenche ao pedir o Uber (ele mesmo é quem vai na corrida). */
export const esquemaUberMotorista = z
  .object({
    viagemId: z.number().int().positive().nullable(),
    origem: local("a origem"),
    destino: local("o destino"),
    motivo: z.enum(MOTIVOS_UBER.map((m) => m.valor) as [MotivoUber, ...MotivoUber[]], { error: "Escolha o motivo." }),
  })
  .refine((d) => d.origem.toLocaleLowerCase("pt-BR") !== d.destino.toLocaleLowerCase("pt-BR"), {
    message: "Origem e destino estão iguais.",
    path: ["destino"],
  })

/** O que o escalador preenche: o mesmo, escolhendo o motorista. */
export const esquemaUberEscalador = esquemaUberMotorista.and(
  z.object({ motoristaId: z.number({ error: "Escolha o motorista." }).int().positive("Escolha o motorista.") }),
)

export type EntradaUberMotorista = z.input<typeof esquemaUberMotorista>
export type EntradaUberEscalador = z.input<typeof esquemaUberEscalador>
