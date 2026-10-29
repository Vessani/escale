import { z } from "@/lib/validation/zod"
import { TAMANHO_MAXIMO_CIDADE_HOTEL, TAMANHO_MAXIMO_NOME_HOTEL } from "@/lib/services/hotel-regras"

const texto = (rotulo: string, informe: string, maximo: number) =>
  z.string().trim().min(2, `Informe ${informe}.`).max(maximo, `${rotulo}: no máximo ${maximo} caracteres.`)

/** O que o motorista preenche ao pedir o hotel (ele mesmo é quem vai pernoitar). */
export const esquemaHotelMotorista = z.object({
  viagemId: z.number().int().positive().nullable(),
  cidade: texto("Cidade", "a cidade do pernoite", TAMANHO_MAXIMO_CIDADE_HOTEL),
  nomeHotel: texto("Hotel", "o nome do hotel", TAMANHO_MAXIMO_NOME_HOTEL),
})

/** O que o escalador preenche: o mesmo, escolhendo o motorista. */
export const esquemaHotelEscalador = esquemaHotelMotorista.and(
  z.object({ motoristaId: z.number({ error: "Escolha o motorista." }).int().positive("Escolha o motorista.") }),
)

export type EntradaHotelMotorista = z.input<typeof esquemaHotelMotorista>
export type EntradaHotelEscalador = z.input<typeof esquemaHotelEscalador>
