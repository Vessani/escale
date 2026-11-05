import type { TipoMotorista } from "@prisma/client"
import { CODIGO_EXAMES, CODIGO_FERIAS, CODIGO_FOLGA, CODIGO_INTERNO, CODIGO_MANUTENCAO, ehDiaDeTrabalho } from "./codigo-jornada"

export type TipoAcaoSugerida = "DAR_FOLGA" | "REVISAR_INTERNO" | "REVISAR_MANUTENCAO" | "NENHUMA"

export type AcaoSugerida = {
  tipo: TipoAcaoSugerida
  texto: string
}

/**
 * Sugestão de ação pra um motorista sem viagem no dia (`rotuloDia`: "hoje",
 * "amanhã"), a partir do código de jornada projetado pro dia (ver
 * jornada.service.ts). É só sugestão: o sistema nunca marca folga sozinho
 * (ver reconciliarFolgaMotoristasNoDiaAtual), quem escala decide e grava.
 */
export function determinarAcaoSugerida(codigoNoDia: number, tipoMotorista: TipoMotorista, rotuloDia = "hoje"): AcaoSugerida {
  if (tipoMotorista === "TREINAMENTO") {
    return { tipo: "NENHUMA", texto: "Em treinamento — só pode ser usado como acompanhante." }
  }

  // Ficar sem viagem é o normal pra quem é do apoio — não sugerir folga por isso.
  if (tipoMotorista === "ENCHEDOR") {
    return { tipo: "NENHUMA", texto: "Enchedor — não faz viagem." }
  }

  if (tipoMotorista === "INTERNO") {
    return { tipo: "NENHUMA", texto: "Interno — apoio da operação." }
  }

  if (ehDiaDeTrabalho(codigoNoDia)) {
    return { tipo: "DAR_FOLGA", texto: `Sem viagem ${rotuloDia} — considere dar folga.` }
  }

  if (codigoNoDia === CODIGO_FOLGA) {
    return { tipo: "NENHUMA", texto: "Já está de folga." }
  }

  if (codigoNoDia === CODIGO_FERIAS) {
    return { tipo: "NENHUMA", texto: "Em férias." }
  }

  if (codigoNoDia === CODIGO_EXAMES) {
    return { tipo: "NENHUMA", texto: "Em exames." }
  }

  if (codigoNoDia === CODIGO_INTERNO) {
    return { tipo: "REVISAR_INTERNO", texto: "Marcado como Interno — confira se ainda faz sentido." }
  }

  if (codigoNoDia === CODIGO_MANUTENCAO) {
    return { tipo: "REVISAR_MANUTENCAO", texto: "Marcado como Manutenção — confira se ainda faz sentido." }
  }

  return { tipo: "NENHUMA", texto: "" }
}
