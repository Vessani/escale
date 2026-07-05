'use server'
import { revalidatePath } from "next/cache";
import { NovaViagemInput, EditarViagemInput } from "@/lib/types/types";
import { errorToMessage } from "@/lib/action-error";
import { ehStatusViagem, type StatusViagemSelecionavel } from "@/lib/services/viagem-status.service";
import { 
  criarViagemService, 
  editarViagemService, 
  deletarViagemService,
  atualizarStatusViagemService,
} from "@/lib/services/viagem.service";

export async function criarViagem(dados: NovaViagemInput) {
  try {
    await criarViagemService(dados);
    
    revalidatePath("/viagens"); 
    return { sucesso: true };
    
  } catch (erro) {
    const mensagem = errorToMessage(erro, "Ocorreu um erro desconhecido ao salvar.");
    
    return { sucesso: false, erro: mensagem };
  }
}

export async function editarViagem(idViagem: number, dados: EditarViagemInput) {
  try {
    await editarViagemService(idViagem, dados);
    
    revalidatePath("/viagens");
    return { sucesso: true };
    
  } catch (erro) {
    const mensagem = errorToMessage(erro, "Ocorreu um erro desconhecido ao editar.");
    
    return { sucesso: false, erro: mensagem };
  }
}

export async function deletarViagem(id: number) {
  try {
    await deletarViagemService(id);
    
    revalidatePath("/viagens");
    return { sucesso: true };
    
  } catch (erro) {
    const mensagem = errorToMessage(erro, "Não foi possível apagar a viagem.");
    
    return { sucesso: false, erro: mensagem };
  }
}

export async function atualizarStatusViagem(idViagem: number, status: StatusViagemSelecionavel) {
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
    const mensagem = errorToMessage(erro, "Não foi possível atualizar o status da viagem.")
    return { sucesso: false, erro: mensagem }
  }
}