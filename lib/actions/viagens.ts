'use server'
import { revalidatePath } from "next/cache";
import {
  NovaViagemInput,
  EditarViagemInput,
  type FalhaImportacaoViagem,
  type ResultadoImportacaoLote,
  type RespostaAcao,
} from "@/lib/types/types";
import type { SugestaoAlocacaoPendente } from "@/lib/types/alocacao";
import { errorToMessage } from "@/lib/action-error";
import { requireSession } from "@/lib/auth-guard";
import { ehStatusViagem, type StatusViagemSelecionavel } from "@/lib/services/viagem-status.service";
import { novaViagemSchema, type NovaViagemFormValues } from "@/lib/validation/viagens";
import {
  criarViagemAvulsaService,
  criarViagemComAlocacaoService,
  editarViagemService,
  deletarViagemService,
  atualizarStatusViagemService,
  atualizarSaidaRealService,
} from "@/lib/services/viagem.service";
import { buscarMotoristasParaSelect } from "@/lib/queries/motoristas";
import {
  calcularAvisoInterjornada,
  calcularDiasDisponiveis,
  calcularIntegracaoExigida,
  sugerirAlocacoesEmLote,
} from "@/lib/services/alocacao.service";
import { mapearRegistrosJornada, projetarCodigoNoDia } from "@/lib/services/jornada.service";
import { formatarHoraLocal, inicioDoDia } from "@/lib/utils/date-format";

export async function criarViagemAvulsa(dados: NovaViagemInput): Promise<RespostaAcao> {
  try {
    await requireSession();
    await criarViagemAvulsaService(dados);

    revalidatePath("/viagens");
    revalidatePath("/motorista");
    return { sucesso: true };

  } catch (erro) {
    console.error("[criarViagemAvulsa] Erro ao salvar viagem:", erro);
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
  await requireSession();

  const motoristasBrutos = await buscarMotoristasParaSelect();
  const motoristas = motoristasBrutos.map((motorista) => ({
    ...motorista,
    registrosJornada: mapearRegistrosJornada(motorista.registrosJornada),
  }));
  const hoje = inicioDoDia(new Date());

  const viagensParaSugestao = viagens.map((viagem, indice) => ({
    id: indice,
    turno: viagem.turno,
    diasViagem: viagem.diasViagem,
    inicioPrevisto: new Date(viagem.inicioPrevisto),
    fimPrevisto: new Date(viagem.fimPrevisto),
    integracaoExigida: calcularIntegracaoExigida(viagem.entregas),
  }));

  const sugestoes = sugerirAlocacoesEmLote(viagensParaSugestao, motoristas, hoje);

  return sugestoes.map((sugestao, indice) => {
    const dataInicioViagem = new Date(viagens[indice].inicioPrevisto);

    return {
      numViagem: viagens[indice].numViagem,
      motoristaSugerido: sugestao.motoristaSugerido
        ? { id: sugestao.motoristaSugerido.id, nome: sugestao.motoristaSugerido.nome }
        : null,
      avisoInterjornada: sugestao.motoristaSugerido
        ? calcularAvisoInterjornada(sugestao.motoristaSugerido.jornadaRelatorioFim, dataInicioViagem)
        : null,
      motoristasCompativeis: sugestao.motoristasCompativeis.map((motorista) => {
        // Mesma jornada projetada usada pra decidir compatibilidade, não o
        // cache de "hoje" — ver mesma lógica em app/viagens/alocacao/page.tsx.
        const codigoNaViagem = projetarCodigoNoDia(
          motorista.registrosJornada,
          dataInicioViagem,
          hoje,
          motorista.diasTrabalhados,
        );

        return {
          id: motorista.id,
          nome: motorista.nome,
          diasTrabalhados: codigoNaViagem,
          diasDisponiveis: calcularDiasDisponiveis(codigoNaViagem),
          turno: motorista.turno,
          horarioHabitual: motorista.jornadaRelatorioInicio ? formatarHoraLocal(motorista.jornadaRelatorioInicio) : null,
        };
      }),
    };
  });
}

/**
 * Cria um lote de viagens já com o motorista escolhido em cada uma (definido
 * na tela de revisão de alocação — ver sugerirAlocacaoParaViagens).
 */
export async function criarViagensEmLoteComAlocacao(
  viagens: Array<{ dados: NovaViagemFormValues; motoristaId: number | null }>,
): Promise<ResultadoImportacaoLote> {
  try {
    await requireSession();
  } catch (erro) {
    return { sucesso: false, criadas: 0, falhas: [{ numViagem: "-", erro: errorToMessage(erro, "Não autorizado.") }] }
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
      await criarViagemComAlocacaoService(validacao.data, motoristaId)
      criadas++
    } catch (erro) {
      console.error(`[criarViagensEmLoteComAlocacao] Erro ao salvar viagem ${identificador}:`, erro)
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
    await requireSession();
    await editarViagemService(idViagem, dados);

    revalidatePath("/viagens");
    revalidatePath("/motorista");
    return { sucesso: true };

  } catch (erro) {
    console.error("[editarViagem] Erro ao editar viagem:", erro);
    const mensagem = errorToMessage(erro, "Ocorreu um erro desconhecido ao editar.");

    return { sucesso: false, erro: mensagem };
  }
}

export async function deletarViagem(id: number): Promise<RespostaAcao> {
  try {
    await requireSession();
    await deletarViagemService(id);

    revalidatePath("/viagens");
    revalidatePath("/motorista");
    return { sucesso: true };
    
  } catch (erro) {
    console.error("[deletarViagem] Erro ao apagar viagem:", erro);
    const mensagem = errorToMessage(erro, "Não foi possível apagar a viagem.");

    return { sucesso: false, erro: mensagem };
  }
}

export async function atualizarStatusViagem(idViagem: number, status: StatusViagemSelecionavel): Promise<RespostaAcao> {
  try {
    await requireSession();

    if (!ehStatusViagem(status)) {
      return { sucesso: false, erro: "Status inválido." }
    }

    await atualizarStatusViagemService(idViagem, status)

    revalidatePath("/viagens")
    revalidatePath("/viagens/alocacao")
    revalidatePath("/motorista")
    return { sucesso: true }
  } catch (erro) {
    console.error("[atualizarStatusViagem] Erro ao atualizar status:", erro);
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
    await requireSession();
    await atualizarSaidaRealService(
      idViagem,
      dados.horarioRealSaida ? new Date(dados.horarioRealSaida) : null,
      dados.motivoAtraso?.trim() ? dados.motivoAtraso.trim() : null,
    )

    revalidatePath("/")
    return { sucesso: true }
  } catch (erro) {
    console.error("[atualizarSaidaReal] Erro ao atualizar saída real:", erro);
    const mensagem = errorToMessage(erro, "Não foi possível atualizar a saída real.")
    return { sucesso: false, erro: mensagem }
  }
}