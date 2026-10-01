import { z } from "./zod"

/**
 * Formulário de manutenção. Datas no formato do <input type="datetime-local">
 * (horário de Brasília, convertido no servidor). Fim previsto é opcional
 * (sem previsão = parado até concluir).
 */
export const manutencaoSchema = z
  .object({
    veiculo: z.enum(["CAVALO", "CARRETA"]),
    codigo: z.string().trim().min(1, "Informe o código do veículo").max(7, "Máximo de 7 caracteres"),
    tipo: z.enum(["PREVENTIVA", "CORRETIVA"]),
    nivel: z.enum(["A", "B", "C", "D"]).nullable(),
    responsavel: z.enum(["WHITE_MARTINS", "RITMO"]),
    descricao: z.string().trim().max(500, "Máximo de 500 caracteres").optional().default(""),
    inicioPrevisto: z.string().min(1, "Informe o início previsto"),
    fimPrevisto: z.string().optional().default(""),
  })
  .refine((dados) => dados.tipo !== "PREVENTIVA" || dados.nivel !== null, {
    message: "Escolha o plano da preventiva (A, B, C ou D).",
    path: ["nivel"],
  })
  .refine((dados) => !dados.fimPrevisto || dados.fimPrevisto > dados.inicioPrevisto, {
    message: "O fim previsto precisa ser depois do início.",
    path: ["fimPrevisto"],
  })

export type ManutencaoFormValues = z.input<typeof manutencaoSchema>
export type ManutencaoDados = z.output<typeof manutencaoSchema>
