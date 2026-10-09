import { z } from "@/lib/validation/zod"
import { KM_MAXIMO_HODOMETRO } from "@/lib/services/limites-registro"
import { DATA_HORA_DO_CAMPO } from "@/lib/validation/troca-motorista"

/**
 * O que a tela manda numa chegada (motorista ou escalador) — data/hora como
 * vem do campo, horário de Brasília. Gases do ar/CO2: manômetro ou balança,
 * com as linhas pol / m³ / kg / % (pol nos campos polInicial/polFinal).
 * Biometano: medicao nula, nível em m³ (nivel*) e em polegadas (pol*).
 */
export type EntradaChegada = {
  km: number
  chegadaEm: string
  medicao: "MANOMETRO" | "BALANCA" | null
  fatorCliente: number | null
  m3Inicial: number | null
  m3Final: number | null
  kgInicial: number | null
  kgFinal: number | null
  pctInicial: number | null
  pctFinal: number | null
  nivelInicial: number | null
  nivelFinal: number | null
  polInicial: number | null
  polFinal: number | null
}

const leitura = z.number().min(0).max(1_000_000).nullable()
const percentual = z.number().min(0).max(100).nullable()

export const esquemaChegada = z.object({
  km: z.number().int().min(0).max(KM_MAXIMO_HODOMETRO),
  chegadaEm: z.string().regex(DATA_HORA_DO_CAMPO, "Data e hora inválidas."),
  medicao: z.enum(["MANOMETRO", "BALANCA"]).nullable(),
  fatorCliente: z.number().positive().max(10_000).nullable(),
  m3Inicial: leitura,
  m3Final: leitura,
  kgInicial: leitura,
  kgFinal: leitura,
  pctInicial: percentual,
  pctFinal: percentual,
  nivelInicial: leitura,
  nivelFinal: leitura,
  polInicial: leitura,
  polFinal: leitura,
})
