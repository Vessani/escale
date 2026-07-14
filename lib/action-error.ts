import { Prisma } from "@prisma/client"

const MENSAGENS_SEGURAS = new Set([
  "Por favor, preencha o e-mail e a senha.",
  "Credenciais inválidas.",
  "Não autorizado.",
  "Viagem não encontrada.",
  "Status de viagem é obrigatório.",
  "Data inválida.",
  "Código de jornada inválido.",
])

function pareceMensagemTecnica(mensagem: string) {
  return (
    /prisma/i.test(mensagem) ||
    /unique constraint/i.test(mensagem) ||
    /foreign key/i.test(mensagem) ||
    /invalid `prisma\./i.test(mensagem) ||
    /code:\s*'P\d{4}'/i.test(mensagem)
  )
}

function mapearErroPrisma(error: Prisma.PrismaClientKnownRequestError) {
  if (error.code === "P2002") {
    const alvo = Array.isArray(error.meta?.target) ? error.meta.target.join(",") : String(error.meta?.target ?? "")

    if (alvo.includes("numViagem")) {
      return "Já existe uma viagem com este número."
    }

    if (alvo.includes("email")) {
      return "Já existe um usuário com este e-mail."
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

export function errorToMessage(error: unknown, fallback: string) {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return mapearErroPrisma(error) ?? fallback
  }

  if (error instanceof Error && error.message) {
    if (MENSAGENS_SEGURAS.has(error.message)) {
      return error.message
    }

    if (pareceMensagemTecnica(error.message)) {
      return fallback
    }
  }

  return fallback
}
