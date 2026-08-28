import { Prisma } from "@prisma/client"
import { ErroDeDominio } from "@/lib/errors"

function mapearErroPrisma(error: Prisma.PrismaClientKnownRequestError) {
  if (error.code === "P2002") {
    const alvo = Array.isArray(error.meta?.target) ? error.meta.target.join(",") : String(error.meta?.target ?? "")

    if (alvo.includes("numViagem")) {
      return "Já existe uma viagem com este número."
    }

    if (alvo.includes("email")) {
      return "Já existe um usuário com este e-mail."
    }

    if (alvo.includes("cpf")) {
      return "Já existe um motorista cadastrado com este CPF."
    }

    return "Já existe um registro com estes dados."
  }

  if (error.code === "P2025") {
    return "O registro informado não foi encontrado."
  }

  if (error.code === "P2003") {
    return "Não foi possível concluir a operação por vínculo com outros dados."
  }

  return null
}

/**
 * Converte um erro capturado numa Server Action pra uma mensagem segura de
 * mostrar ao usuário. Erros de negócio devem ser lançados como ErroDeDominio
 * (ver lib/errors.ts) — qualquer outro throw (bug, erro de infra não mapeado)
 * cai no `fallback` genérico, nunca vaza mensagem técnica/stack.
 */
export function errorToMessage(error: unknown, fallback: string) {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return mapearErroPrisma(error) ?? fallback
  }

  if (error instanceof ErroDeDominio) {
    return error.mensagemSegura
  }

  return fallback
}
