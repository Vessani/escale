'use server'

import { revalidatePath } from "next/cache"
import { requireSessaoMotorista } from "@/lib/auth-guard"
import { errorToMessage } from "@/lib/action-error"
import { atorDaSessao } from "@/lib/services/auditoria.service"
import { AREA_MOTORISTA } from "@/lib/papeis"
import {
  adicionarMinhaDespesa,
  encerrarMinhaViagem,
  informarProblemaMecanico,
  iniciarMinhaViagem,
  registrarChegadaCliente,
  removerMinhaDespesa,
  TAMANHO_MAXIMO_PROBLEMA,
} from "@/lib/services/minhas-viagens.service"
import { z } from "@/lib/validation/zod"
import type { RespostaAcao } from "@/lib/types/types"
import { trocarMotoristaDaViagem } from "@/lib/services/troca-motorista.service"
import { esquemaTroca, type EntradaTroca } from "@/lib/validation/troca-motorista"

const id = z.number().int().positive()
const km = z.number().int().min(0).max(9_999_999)

/** O que o motorista registra muda o Dashboard e as telas de viagem do despacho. */
function revalidarTelas(viagemId?: number) {
  revalidatePath(AREA_MOTORISTA)
  if (viagemId) revalidatePath(`${AREA_MOTORISTA}/${viagemId}`)
  revalidatePath("/")
  revalidatePath("/viagens")
}

async function executar(acao: () => Promise<unknown>, viagemId: number | undefined, fallback: string): Promise<RespostaAcao> {
  try {
    await acao()
    revalidarTelas(viagemId)
    return { sucesso: true }
  } catch (erro) {
    return { sucesso: false, erro: errorToMessage(erro, fallback) }
  }
}

export async function iniciarViagem(viagemId: number, dados: { kmInicial: number; motivoAtraso: string | null }): Promise<RespostaAcao> {
  return executar(async () => {
    const { session, filialId, motoristaId } = await requireSessaoMotorista()
    const entrada = z.object({ viagemId: id, kmInicial: km, motivoAtraso: z.string().max(200).nullable() }).parse({ ...dados, viagemId })
    await iniciarMinhaViagem(filialId, motoristaId, entrada.viagemId, entrada, atorDaSessao(session))
  }, viagemId, "Não foi possível iniciar a viagem.")
}

export async function lancarDespesa(viagemId: number, dados: { tipo: "PEDAGIO" | "PERNOITE"; valorCentavos: number }): Promise<RespostaAcao> {
  return executar(async () => {
    const { session, filialId, motoristaId } = await requireSessaoMotorista()
    const entrada = z
      .object({ viagemId: id, tipo: z.enum(["PEDAGIO", "PERNOITE"]), valorCentavos: z.number().int().positive() })
      .parse({ ...dados, viagemId })
    await adicionarMinhaDespesa(filialId, motoristaId, entrada.viagemId, entrada, atorDaSessao(session))
  }, viagemId, "Não foi possível lançar.")
}

export async function removerDespesa(viagemId: number, despesaId: number): Promise<RespostaAcao> {
  return executar(async () => {
    const { session, filialId, motoristaId } = await requireSessaoMotorista()
    id.parse(viagemId)
    await removerMinhaDespesa(filialId, motoristaId, id.parse(despesaId), atorDaSessao(session))
  }, viagemId, "Não foi possível remover.")
}

export async function encerrarViagem(viagemId: number, dados: { kmFinal: number }): Promise<RespostaAcao> {
  return executar(async () => {
    const { session, filialId, motoristaId } = await requireSessaoMotorista()
    const entrada = z.object({ viagemId: id, kmFinal: km }).parse({ ...dados, viagemId })
    await encerrarMinhaViagem(filialId, motoristaId, entrada.viagemId, entrada, atorDaSessao(session))
  }, viagemId, "Não foi possível encerrar a viagem.")
}

const leitura = z.number().min(0).max(1_000_000).nullable()

export async function registrarChegada(
  viagemId: number,
  entregaId: number,
  dados: {
    km: number
    chegadaEm: string
    medicao: "MANOMETRO" | "BALANCA" | null
    nivelInicial: number | null
    nivelFinal: number | null
    fatorCliente: number | null
    polInicial: number | null
    polFinal: number | null
  },
): Promise<RespostaAcao> {
  return executar(async () => {
    const { session, filialId, motoristaId } = await requireSessaoMotorista()
    id.parse(viagemId)
    const entrada = z
      .object({
        entregaId: id,
        km,
        chegadaEm: z.string().datetime({ offset: true }),
        medicao: z.enum(["MANOMETRO", "BALANCA"]).nullable(),
        nivelInicial: leitura,
        nivelFinal: leitura,
        fatorCliente: z.number().positive().max(10_000).nullable(),
        polInicial: leitura,
        polFinal: leitura,
      })
      .parse({ ...dados, entregaId })
    await registrarChegadaCliente(
      filialId,
      motoristaId,
      entrada.entregaId,
      { ...entrada, chegadaEm: new Date(entrada.chegadaEm) },
      atorDaSessao(session),
    )
  }, viagemId, "Não foi possível registrar a chegada.")
}

export async function informarProblema(viagemId: number, texto: string): Promise<RespostaAcao> {
  return executar(async () => {
    const { session, filialId, motoristaId } = await requireSessaoMotorista()
    const entrada = z.object({ viagemId: id, texto: z.string().max(TAMANHO_MAXIMO_PROBLEMA) }).parse({ texto, viagemId })
    await informarProblemaMecanico(filialId, motoristaId, entrada.viagemId, entrada.texto, atorDaSessao(session))
  }, viagemId, "Não foi possível salvar o problema.")
}

/** O motorista que está com a viagem passa ela pro substituto (que continua pelo celular dele). */
export async function passarViagem(viagemId: number, dados: EntradaTroca): Promise<RespostaAcao> {
  return executar(async () => {
    const { session, filialId, motoristaId } = await requireSessaoMotorista()
    const entrada = esquemaTroca.parse({ ...dados, viagemId })
    await trocarMotoristaDaViagem(
      filialId,
      entrada.viagemId,
      { ...entrada, trocadoEm: new Date(entrada.trocadoEm) },
      atorDaSessao(session),
      { exigirMotoristaAtual: motoristaId },
    )
  }, viagemId, "Não foi possível passar a viagem.")
}

