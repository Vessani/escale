import { ErroDeDominio } from "@/lib/errors"
import { errorToMessage } from "@/lib/action-error"

const FALLBACK_API = "Ocorreu um erro inesperado."

/** Status HTTP por código de ErroDeDominio (ver lib/errors.ts) — código sem entrada aqui cai em 422. */
const STATUS_POR_CODIGO: Record<string, number> = {
  NAO_AUTORIZADO: 401,
  VIAGEM_NAO_ENCONTRADA: 404,
}

function respostaJson(corpo: unknown, status: number) {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { "Content-Type": "application/json" },
  })
}

/** Resposta de sucesso padrão de toda rota da API — sempre `{ data }`. */
export function respostaSucesso<T>(data: T, status = 200) {
  return respostaJson({ data }, status)
}

/**
 * Resposta de erro padrão — sempre `{ erro: mensagem segura }`. Reaproveita
 * errorToMessage (a mesma função usada pelas Server Actions) pra nunca vazar
 * mensagem técnica; o status HTTP vem do código do ErroDeDominio quando o
 * erro é um (ver STATUS_POR_CODIGO), senão 500 (bug/erro não mapeado).
 */
export function respostaErro(erro: unknown) {
  const mensagem = errorToMessage(erro, FALLBACK_API)
  const status = erro instanceof ErroDeDominio ? (STATUS_POR_CODIGO[erro.codigo] ?? 422) : 500

  return respostaJson({ erro: mensagem }, status)
}
