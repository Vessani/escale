import type { TipoMotorista } from "@prisma/client"

export type TipoAcaoSugerida = "DAR_FOLGA" | "REVISAR_INTERNO" | "REVISAR_MANUTENCAO" | "NENHUMA"

export type AcaoSugerida = {
  tipo: TipoAcaoSugerida
  texto: string
}

/**
 * Sugestão de ação pra um motorista sem viagem hoje, a partir do código de
 * jornada projetado pro dia (ver jornada.service.ts). A leitura pra 1-6 é a
 * mesma de deveMarcarMotoristaComoFolga (folga.service.ts) — aqui vira uma
 * sugestão pro despachante revisar manualmente em vez de reconciliação
 * automática, já que essa tela lista todo mundo de uma vez, não só quem
 * acabou de ter uma viagem alterada.
 */
export function determinarAcaoSugerida(codigoHoje: number, tipoMotorista: TipoMotorista): AcaoSugerida {
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

  if (codigoHoje >= 1 && codigoHoje <= 6) {
    return { tipo: "DAR_FOLGA", texto: "Sem viagem hoje — considere dar folga." }
  }

  if (codigoHoje === 7) {
    return { tipo: "NENHUMA", texto: "Já está de folga." }
  }

  if (codigoHoje === 8) {
    return { tipo: "NENHUMA", texto: "Em férias." }
  }

  if (codigoHoje === 9) {
    return { tipo: "NENHUMA", texto: "Em exames." }
  }

  if (codigoHoje === 10) {
    return { tipo: "REVISAR_INTERNO", texto: "Marcado como Interno — confira se ainda faz sentido." }
  }

  if (codigoHoje === 11) {
    return { tipo: "REVISAR_MANUTENCAO", texto: "Marcado como Manutenção — confira se ainda faz sentido." }
  }

  return { tipo: "NENHUMA", texto: "" }
}
