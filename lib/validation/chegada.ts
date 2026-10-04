import { z } from "@/lib/validation/zod"
import { KM_MAXIMO_HODOMETRO } from "@/lib/services/limites-registro"
import { DATA_HORA_DO_CAMPO } from "@/lib/validation/troca-motorista"

/** O que a tela manda numa chegada (motorista ou escalador) — data/hora como vem do campo, horário de Brasília. */
export type EntradaChegada = {
  km: number
  chegadaEm: string
  medicao: "MANOMETRO" | "BALANCA" | null
  nivelInicial: number | null
  nivelFinal: number | null
  fatorCliente: number | null
  polInicial: number | null
  polFinal: number | null
}

const leitura = z.number().min(0).max(1_000_000).nullable()

export const esquemaChegada = z.object({
  km: z.number().int().min(0).max(KM_MAXIMO_HODOMETRO),
  chegadaEm: z.string().regex(DATA_HORA_DO_CAMPO, "Data e hora inválidas."),
  medicao: z.enum(["MANOMETRO", "BALANCA"]).nullable(),
  nivelInicial: leitura,
  nivelFinal: leitura,
  fatorCliente: z.number().positive().max(10_000).nullable(),
  polInicial: leitura,
  polFinal: leitura,
})
