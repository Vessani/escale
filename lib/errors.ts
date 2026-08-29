/**
 * Erro de negócio com mensagem já segura pra mostrar ao usuário (pt-BR,
 * pronta pra exibir) e um código estável — substitui o roteamento por
 * comparação de string que existia em action-error.ts (MENSAGENS_SEGURAS):
 * ali, um erro de negócio só chegava ao usuário se o texto batesse
 * exatamente com uma entrada de um Set; um typo na mensagem, em qualquer um
 * dos dois lados, vazava o fallback genérico sem avisar ninguém. Aqui
 * `errorToMessage` só precisa checar `instanceof ErroDeDominio`.
 */
export class ErroDeDominio extends Error {
  readonly codigo: string
  readonly mensagemSegura: string

  constructor(codigo: string, mensagemSegura: string) {
    super(mensagemSegura)
    this.name = "ErroDeDominio"
    this.codigo = codigo
    this.mensagemSegura = mensagemSegura
  }
}

/** Sessão ausente, ou papel sem permissão pra ação — ver lib/auth-guard.ts. */
export class NaoAutorizadoError extends ErroDeDominio {
  constructor() {
    super("NAO_AUTORIZADO", "Não autorizado.")
  }
}

/** Id de viagem que não existe (ou não pertence à filial da sessão) — ver viagem.service.ts. */
export class ViagemNaoEncontradaError extends ErroDeDominio {
  constructor() {
    super("VIAGEM_NAO_ENCONTRADA", "Viagem não encontrada.")
  }
}

/** atualizarStatusViagemService exige um status explícito. */
export class StatusViagemObrigatorioError extends ErroDeDominio {
  constructor() {
    super("STATUS_VIAGEM_OBRIGATORIO", "Status de viagem é obrigatório.")
  }
}

/** Bloqueio rígido: motorista sem esse produto em produtosAutorizados — ver garantirMotoristaAutorizadoParaProduto. */
export class MotoristaProdutoNaoAutorizadoError extends ErroDeDominio {
  constructor() {
    super("MOTORISTA_PRODUTO_NAO_AUTORIZADO", "Motorista não autorizado a carregar o produto desta viagem.")
  }
}

/** Cavalo+carreta já cadastrados noutro conjunto ativo da mesma filial — ver frota.service.ts. */
export class FrotaDuplicadaError extends ErroDeDominio {
  constructor() {
    super("FROTA_DUPLICADA", "Já existe um conjunto cadastrado com essa frota (cavalo/carreta).")
  }
}

/** String fora do formato YYYY-MM-DD, ou data de calendário inexistente — ver parseDataLocal. */
export class DataInvalidaError extends ErroDeDominio {
  constructor() {
    super("DATA_INVALIDA", "Data inválida.")
  }
}

/** Número de viagem já usado por outra viagem ativa da mesma filial — ver garantirNumViagemDisponivel em viagem.service.ts. */
export class NumViagemDuplicadaError extends ErroDeDominio {
  constructor() {
    super("NUM_VIAGEM_DUPLICADA", "Já existe uma viagem com este número.")
  }
}
