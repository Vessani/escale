'use server'
import { revalidatePath } from "next/cache";
import { NovoMotoristaInput, EditarMotoristaInput } from "@/lib/types/types";
import { errorToMessage } from "@/lib/action-error";
import { 
  criarMotoristaService, 
  editarMotoristaService, 
  deletarMotoristaService 
} from "@/lib/services/motorista.service";

export async function criarMotorista(dados: NovoMotoristaInput) {
  try {
    await criarMotoristaService(dados);
    
    revalidatePath("/motorista"); 
    return { sucesso: true };
  } catch (error) {
    return { sucesso: false, erro: errorToMessage(error, "Erro ao criar motorista.") };
  }
}

export async function editarMotorista(idMotorista: number, dados: EditarMotoristaInput) {
  try {
    await editarMotoristaService(idMotorista, dados);
    
    revalidatePath("/motorista");
    return { sucesso: true };
  } catch (error) {
    return { sucesso: false, erro: errorToMessage(error, "Erro ao editar motorista.") };
  }
}

export async function deletarMotorista(id: number) {
  try {
    await deletarMotoristaService(id);
    
    revalidatePath("/motorista");
    return { sucesso: true };
  } catch (error) {
    return { sucesso: false, erro: errorToMessage(error, "Erro ao deletar motorista.") };
  }
}