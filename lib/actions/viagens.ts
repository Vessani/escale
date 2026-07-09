'use server'
import { revalidatePath } from "next/cache";
import {
  NovaViagemInput,
  EditarViagemInput,
  type FalhaImportacaoViagem,
  type ResultadoImportacaoLote,
  type RespostaAcao,
} from "@/lib/types/types";
import { errorToMessage } from "@/lib/action-error";
import { ehStatusViagem, type StatusViagemSelecionavel } from "@/lib/services/viagem-status.service";
import { novaViagemSchema, type NovaViagemFormValues } from "@/lib/validation/viagens";
import {
  criarViagemService,
  criarViagemSemAlocacaoService,
  editarViagemService,
  deletarViagemService,
  atualizarStatusViagemService,
} from "@/lib/services/viagem.service";

export async function criarViagem(dados: NovaViagemInput): Promise<RespostaAcao> {
  try {
    await criarViagemService(dados);

    revalidatePath("/viagens");
    return { sucesso: true };

  } catch (erro) {
    console.error("[criarViagem] Erro ao salvar viagem:", erro);
    const mensagem = errorToMessage(erro, "Ocorreu um erro desconhecido ao salvar.");

    return { sucesso: false, erro: mensagem };
  }
}

export async function criarViagensEmLote(viagens: NovaViagemFormValues[]): Promise<ResultadoImportacaoLote> {
  let criadas = 0
  const falhas: FalhaImportacaoViagem[] = []

  for (const dadosForm of viagens) {
    const identificador = dadosForm.numViagem || "(sem número)"
    const validacao = novaViagemSchema.safeParse(dadosForm)

    if (!validacao.success) {
      const mensagem = validacao.error.issues[0]?.message ?? "Dados inválidos."
      falhas.push({ numViagem: identificador, erro: mensagem })
      continue
    }

    try {
      await criarViagemSemAlocacaoService(validacao.data)
      criadas++
    } catch (erro) {
      console.error(`[criarViagensEmLote] Erro ao salvar viagem ${identificador}:`, erro)
      falhas.push({ numViagem: identificador, erro: errorToMessage(erro, "Erro desconhecido ao salvar.") })
    }
  }

  revalidatePath("/viagens")
  revalidatePath("/viagens/alocacao")

  return { sucesso: falhas.length === 0, criadas, falhas }
}

export async function editarViagem(idViagem: number, dados: EditarViagemInput): Promise<RespostaAcao> {
  try {
    await editarViagemService(idViagem, dados);

    revalidatePath("/viagens");
    return { sucesso: true };

  } catch (erro) {
    console.error("[editarViagem] Erro ao editar viagem:", erro);
    const mensagem = errorToMessage(erro, "Ocorreu um erro desconhecido ao editar.");

    return { sucesso: false, erro: mensagem };
  }
}

export async function deletarViagem(id: number): Promise<RespostaAcao> {
  try {
    await deletarViagemService(id);
    
    revalidatePath("/viagens");
    return { sucesso: true };
    
  } catch (erro) {
    console.error("[deletarViagem] Erro ao apagar viagem:", erro);
    const mensagem = errorToMessage(erro, "Não foi possível apagar a viagem.");

    return { sucesso: false, erro: mensagem };
  }
}

export async function atualizarStatusViagem(idViagem: number, status: StatusViagemSelecionavel): Promise<RespostaAcao> {
  try {
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