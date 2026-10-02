/**
 * Chamada de server action pela tela, sem derrubar a página quando a
 * chamada nem chega a responder.
 *
 * As actions já devolvem { sucesso: false, erro } pros erros de negócio. Se
 * a chamada LANÇA, dentro de uma transição isso jogava a tela inteira pra
 * página de erro, perdendo o que a pessoa digitou. Aqui vira mensagem na
 * própria tela — com o motivo certo:
 *  - rede caiu (motorista sem sinal, wifi oscilando) → tente de novo;
 *  - o sistema foi atualizado com a tela aberta (celular do motorista fica
 *    horas aberto; depois de um deploy a action antiga não existe mais) →
 *    recarregue a página;
 *  - qualquer outra coisa → recarregue a página.
 */
export const MENSAGEM_SEM_CONEXAO =
  "Sem conexão com o servidor. Confira a internet (ou o sinal do celular) e tente de novo — o que você digitou continua aqui."
export const MENSAGEM_SISTEMA_ATUALIZADO = "O sistema foi atualizado enquanto a tela estava aberta. Recarregue a página e tente de novo."
export const MENSAGEM_ERRO_INESPERADO = "Algo deu errado. Recarregue a página e tente de novo."

/** O porquê de uma chamada que lançou (exportado pra teste). */
export function mensagemDaFalha(erro: unknown): string {
  const texto = erro instanceof Error ? erro.message : String(erro)
  if (/server action|older or newer deployment/i.test(texto)) return MENSAGEM_SISTEMA_ATUALIZADO
  const offline = typeof navigator !== "undefined" && navigator.onLine === false
  // fetch sem rede: "Failed to fetch" (Chrome), "NetworkError…" (Firefox), "Load failed" (Safari).
  // Pelo texto, não por ser TypeError: bug comum ("Cannot read properties of undefined") também é TypeError.
  if (offline || /failed to fetch|networkerror|load failed|network request failed/i.test(texto)) return MENSAGEM_SEM_CONEXAO
  return MENSAGEM_ERRO_INESPERADO
}

export async function chamarAcao<R extends { sucesso: boolean }>(acao: () => Promise<R>): Promise<R | { sucesso: false; erro: string }> {
  try {
    return await acao()
  } catch (erro) {
    console.warn("[acao] sem resposta do servidor", erro)
    return { sucesso: false, erro: mensagemDaFalha(erro) }
  }
}
