'use server'
import { revalidatePath } from "next/cache";
import { buscarProdutoPorCarreta } from "@/lib/queries/frotas";
import { montarMotoristaCompativel } from "@/lib/services/motorista-compativel.service";
import {
  NovaViagemInput,
  EditarViagemInput,
  type FalhaImportacaoViagem,
  type ResultadoImportacaoLote,
  type RespostaAcao,
} from "@/lib/types/types";
import type { SugestaoAlocacaoPendente } from "@/lib/types/alocacao";
import { errorToMessage } from "@/lib/action-error";
import { requireSessionComFilial } from "@/lib/auth-guard";
import { atorDaSessao } from "@/lib/services/auditoria.service";
import { ehStatusViagem, type StatusViagemSelecionavel } from "@/lib/services/viagem-status.service";
import { novaViagemSchema, editarViagemServerSchema, type NovaViagemFormValues } from "@/lib/validation/viagens";
import {
  criarViagemAvulsaService,
  criarViagemComAlocacaoService,
  editarViagemService,
  deletarViagemService,
  atualizarStatusViagemService,
  atualizarSaidaRealService,
} from "@/lib/services/viagem.service";
import { buscarMotoristasParaSelect } from "@/lib/queries/motoristas";
import { buscarNumerosSapQueExigemIntegracao } from "@/lib/queries/clientes";
import {
  calcularAvisoDescanso,
  calcularIntegracaoExigida,
  sugerirAlocacoesEmLote,
} from "@/lib/services/alocacao.service";
import { calcularAvisoFrotaIndisponivel, calcularAvisoFrotaProduto } from "@/lib/services/frota.service";
import { prepararJornadaDoMotorista } from "@/lib/services/jornada.service";
import { converterEntradaDeDataHora, inicioDoDia } from "@/lib/utils/date-format";
import { ErroDeDominio } from "@/lib/errors";
import { TAMANHO_MAXIMO_MOTIVO } from "@/lib/services/motivos-atraso";
import { DATA_HORA_DO_CAMPO } from "@/lib/validation/troca-motorista";
import { z } from "@/lib/validation/zod";

/** Teto de uma importação de planilha — acima disso é arquivo errado. */
const MAX_VIAGENS_POR_LOTE = 500;
/** Quantas viagens do lote calculam aviso de frota ao mesmo tempo (2 consultas cada). */
const CONSULTAS_POR_BLOCO = 10;
/** "YYYY-MM-DDTHH:MM" (campo datetime-local) ou ISO completo. */
const dataHoraDoCampo = z.string().max(40).refine(
  (texto) => DATA_HORA_DO_CAMPO.test(texto) || !Number.isNaN(new Date(texto).getTime()),
  "Data e hora inválidas.",
);

export async function criarViagemAvulsa(dados: NovaViagemInput): Promise<RespostaAcao> {
  try {
    const { session, filialId } = await requireSessionComFilial();

    const validacao = novaViagemSchema.safeParse(dados);
    if (!validacao.success) {
      return { sucesso: false, erro: validacao.error.issues[0]?.message ?? "Dados inválidos." };
    }

    await criarViagemAvulsaService(filialId, validacao.data, atorDaSessao(session));

    revalidatePath("/viagens");
    revalidatePath("/motorista");
    return { sucesso: true };

  } catch (erro) {
    const mensagem = errorToMessage(erro, "Ocorreu um erro desconhecido ao salvar.");

    return { sucesso: false, erro: mensagem };
  }
}

/**
 * Calcula, sem persistir nada, a sugestão de motorista para cada viagem de um
 * lote ainda não criado (ex: acabou de sair do parser de XLSX) — usado na
 * tela de revisão antes de confirmar a criação em lote.
 */
export async function sugerirAlocacaoParaViagens(
  viagens: NovaViagemFormValues[],
): Promise<SugestaoAlocacaoPendente[]> {
  const { filialId } = await requireSessionComFilial();
  if (!Array.isArray(viagens) || viagens.length > MAX_VIAGENS_POR_LOTE) {
    throw new ErroDeDominio("LOTE_GRANDE", `Importe no máximo ${MAX_VIAGENS_POR_LOTE} viagens por vez.`);
  }

  const [motoristasBrutos, numerosSapQueExigemIntegracao, produtoPorCarreta] = await Promise.all([
    buscarMotoristasParaSelect(filialId),
    buscarNumerosSapQueExigemIntegracao(),
    // Produto de cada carreta cadastrada — preenche o produto da viagem na
    // revisão do import, pra não precisar escolher viagem por viagem.
    buscarProdutoPorCarreta(filialId, viagens.map((viagem) => viagem.carreta)),
  ]);
  const motoristas = motoristasBrutos.map((motorista) => ({
    ...motorista,
    ...prepararJornadaDoMotorista(motorista),
  }));
  const hoje = inicioDoDia(new Date());
  // Viagem do import ainda sem produto: usa o da carreta cadastrada, então a
  // primeira sugestão já sai filtrada pelo produto certo.
  const produtoEfetivo = (viagem: NovaViagemFormValues) => viagem.produto || produtoPorCarreta.get(viagem.carreta) || null;

  const viagensParaSugestao = viagens.map((viagem, indice) => ({
    id: indice,
    turno: viagem.turno,
    diasViagem: viagem.diasViagem,
    inicioPrevisto: new Date(viagem.inicioPrevisto),
    fimPrevisto: new Date(viagem.fimPrevisto),
    integracaoExigida: calcularIntegracaoExigida(viagem.entregas, numerosSapQueExigemIntegracao),
    produtoExigido: produtoEfetivo(viagem),
  }));

  const sugestoes = sugerirAlocacoesEmLote(viagensParaSugestao, motoristas, hoje);

  // Avisos de frota em blocos: um Promise.all do lote inteiro abria centenas
  // de consultas ao mesmo tempo (2 por viagem) e esgotava o pool do banco.
  const resultado: SugestaoAlocacaoPendente[] = [];
  for (let inicio = 0; inicio < sugestoes.length; inicio += CONSULTAS_POR_BLOCO) {
    const bloco = sugestoes.slice(inicio, inicio + CONSULTAS_POR_BLOCO);
    resultado.push(...(await Promise.all(bloco.map((sugestao, posicao) => montarSugestao(sugestao, inicio + posicao)))));
  }
  return resultado;

  async function montarSugestao(sugestao: (typeof sugestoes)[number], indice: number): Promise<SugestaoAlocacaoPendente> {
    const dataInicioViagem = new Date(viagens[indice].inicioPrevisto);
    const avisoFrotaIndisponivel = await calcularAvisoFrotaIndisponivel(
      filialId,
      viagens[indice].cavalo,
      viagens[indice].carreta,
      dataInicioViagem,
      new Date(viagens[indice].fimPrevisto),
    );
    const avisoFrotaProdutoIncompativel = await calcularAvisoFrotaProduto(
      filialId,
      viagens[indice].cavalo,
      viagens[indice].carreta,
      produtoEfetivo(viagens[indice]),
    );

    return {
      numViagem: viagens[indice].numViagem,
      produtoDaFrota: produtoPorCarreta.get(viagens[indice].carreta) ?? null,
      motoristaSugerido: sugestao.motoristaSugerido
        ? { id: sugestao.motoristaSugerido.id, nome: sugestao.motoristaSugerido.nome }
        : null,
      // Mesma regra do aviso gravado na viagem (relatório + viagens, finalizada
      // contando da finalização, 11h/35h) — ver calcularAvisoDescanso.
      avisoInterjornada: sugestao.motoristaSugerido
        ? calcularAvisoDescanso(sugestao.motoristaSugerido, { inicioPrevisto: dataInicioViagem }, hoje)
        : null,
      avisoFrotaIndisponivel,
      avisoFrotaProdutoIncompativel,
      motoristasCompativeis: sugestao.motoristasCompativeis.map((motorista) =>
        montarMotoristaCompativel(motorista, { inicioPrevisto: dataInicioViagem }, hoje),
      ),
    };
  }
}

/**
 * Cria um lote de viagens já com o motorista escolhido em cada uma (definido
 * na tela de revisão de alocação — ver sugerirAlocacaoParaViagens).
 */
export async function criarViagensEmLoteComAlocacao(
  viagens: Array<{ dados: NovaViagemFormValues; motoristaId: number | null }>,
): Promise<ResultadoImportacaoLote> {
  let filialId: number
  let ator: ReturnType<typeof atorDaSessao>
  try {
    const resultado = await requireSessionComFilial();
    filialId = resultado.filialId
    ator = atorDaSessao(resultado.session)
  } catch (erro) {
    return { sucesso: false, criadas: 0, falhas: [{ numViagem: "-", erro: errorToMessage(erro, "Não autorizado.") }] }
  }

  if (!Array.isArray(viagens) || viagens.length > MAX_VIAGENS_POR_LOTE) {
    return { sucesso: false, criadas: 0, falhas: [{ numViagem: "-", erro: `Importe no máximo ${MAX_VIAGENS_POR_LOTE} viagens por vez.` }] }
  }

  let criadas = 0
  const falhas: FalhaImportacaoViagem[] = []

  for (const { dados: dadosForm, motoristaId } of viagens) {
    const identificador = dadosForm.numViagem || "(sem número)"
    const validacao = novaViagemSchema.safeParse(dadosForm)

    if (!validacao.success) {
      const mensagem = validacao.error.issues[0]?.message ?? "Dados inválidos."
      falhas.push({ numViagem: identificador, erro: mensagem })
      continue
    }

    try {
      await criarViagemComAlocacaoService(filialId, validacao.data, motoristaId, ator)
      criadas++
    } catch (erro) {
      falhas.push({ numViagem: identificador, erro: errorToMessage(erro, "Erro desconhecido ao salvar.") })
    }
  }

  revalidatePath("/viagens")
  revalidatePath("/viagens/alocacao")
  revalidatePath("/motorista")

  return { sucesso: falhas.length === 0, criadas, falhas }
}

export async function editarViagem(idViagem: number, dados: EditarViagemInput): Promise<RespostaAcao> {
  try {
    const { session, filialId } = await requireSessionComFilial();

    const validacao = editarViagemServerSchema.safeParse(dados);
    if (!validacao.success) {
      return { sucesso: false, erro: validacao.error.issues[0]?.message ?? "Dados inválidos." };
    }

    await editarViagemService(filialId, idViagem, validacao.data, atorDaSessao(session));

    revalidatePath("/viagens");
    revalidatePath("/motorista");
    revalidatePath("/");
    return { sucesso: true };

  } catch (erro) {
    const mensagem = errorToMessage(erro, "Ocorreu um erro desconhecido ao editar.");

    return { sucesso: false, erro: mensagem };
  }
}

export async function deletarViagem(id: number): Promise<RespostaAcao> {
  try {
    const { session, filialId } = await requireSessionComFilial(["ADMIN"]);
    await deletarViagemService(filialId, id, atorDaSessao(session));

    revalidatePath("/viagens");
    revalidatePath("/motorista");
    revalidatePath("/");
    return { sucesso: true };

  } catch (erro) {
    const mensagem = errorToMessage(erro, "Não foi possível apagar a viagem.");

    return { sucesso: false, erro: mensagem };
  }
}

export async function atualizarStatusViagem(
  idViagem: number,
  status: StatusViagemSelecionavel,
  novaData?: { inicioPrevisto: string; fimPrevisto: string },
): Promise<RespostaAcao> {
  try {
    const { session, filialId } = await requireSessionComFilial();

    if (!ehStatusViagem(status)) {
      return { sucesso: false, erro: "Status inválido." }
    }

    if (status === "POSTERGADA" && (!novaData?.inicioPrevisto || !novaData?.fimPrevisto)) {
      return { sucesso: false, erro: "Informe a nova data de início e fim para postergar a viagem." }
    }
    if (novaData) {
      z.object({ inicioPrevisto: dataHoraDoCampo, fimPrevisto: dataHoraDoCampo }).parse(novaData)
    }

    await atualizarStatusViagemService(
      filialId,
      idViagem,
      status,
      atorDaSessao(session),
      novaData
        ? {
            inicioPrevisto: converterEntradaDeDataHora(novaData.inicioPrevisto),
            fimPrevisto: converterEntradaDeDataHora(novaData.fimPrevisto),
          }
        : undefined,
    )

    revalidatePath("/viagens")
    revalidatePath("/viagens/alocacao")
    revalidatePath("/motorista")
    revalidatePath("/")
    return { sucesso: true }
  } catch (erro) {
    const mensagem = errorToMessage(erro, "Não foi possível atualizar o status da viagem.")
    return { sucesso: false, erro: mensagem }
  }
}

/** Registro rápido pelo dashboard — ver buscarViagensDoDashboard (lib/queries/viagens.ts). */
export async function atualizarSaidaReal(
  idViagem: number,
  dados: { horarioRealSaida: string | null; motivoAtraso: string | null },
): Promise<RespostaAcao> {
  try {
    const { session, filialId } = await requireSessionComFilial();
    z.object({
      horarioRealSaida: dataHoraDoCampo.nullable(),
      motivoAtraso: z.string().max(TAMANHO_MAXIMO_MOTIVO, `O motivo aceita até ${TAMANHO_MAXIMO_MOTIVO} caracteres.`).nullable(),
    }).parse(dados)
    await atualizarSaidaRealService(
      filialId,
      idViagem,
      dados.horarioRealSaida ? converterEntradaDeDataHora(dados.horarioRealSaida) : null,
      dados.motivoAtraso?.trim() ? dados.motivoAtraso.trim() : null,
      atorDaSessao(session),
    )

    revalidatePath("/")
    return { sucesso: true }
  } catch (erro) {
    const mensagem = errorToMessage(erro, "Não foi possível atualizar a saída real.")
    return { sucesso: false, erro: mensagem }
  }
}
