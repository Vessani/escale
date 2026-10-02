/**
 * Chamada de server action pela tela, à prova de queda de conexão.
 *
 * As actions já devolvem { sucesso: false, erro } pros erros de negócio —
 * mas se a rede cai (motorista sem sinal na estrada, wifi do escritório
 * oscilando) ou o servidor nem responde, a chamada LANÇA, e dentro de uma
 * transição isso derruba a tela inteira pra página de erro, perdendo o que
 * a pessoa digitou. Aqui vira uma mensagem na própria tela, e ela tenta de novo.
 */
export const MENSAGEM_SEM_CONEXAO =
  "Sem conexão com o servidor. Confira a internet (ou o sinal do celular) e tente de novo — o que você digitou continua aqui."

export async function chamarAcao<R extends { sucesso: boolean }>(acao: () => Promise<R>): Promise<R | { sucesso: false; erro: string }> {
  try {
    return await acao()
  } catch (erro) {
    console.warn("[acao] sem resposta do servidor", erro)
    return { sucesso: false, erro: MENSAGEM_SEM_CONEXAO }
  }
}
