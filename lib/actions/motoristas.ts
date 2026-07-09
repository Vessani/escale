'use server'
import { revalidatePath } from "next/cache";
import { NovoMotoristaInput, EditarMotoristaInput, type RespostaAcao } from "@/lib/types/types";
import { errorToMessage } from "@/lib/action-error";
import {
  criarMotoristaService,
  editarMotoristaService,
  deletarMotoristaService,
  registrarJornadaNoDiaService,
} from "@/lib/services/motorista.service";

export async function criarMotorista(dados: NovoMotoristaInput): Promise<RespostaAcao> {
  try {
    await criarMotoristaService(dados);
    
    revalidatePath("/motorista"); 
    return { sucesso: true };
  } catch (error) {
    return { sucesso: false, erro: errorToMessage(error, "Erro ao criar motorista.") };
  }
}

export async function editarMotorista(idMotorista: number, dados: EditarMotoristaInput): Promise<RespostaAcao> {
  try {
    await editarMotoristaService(idMotorista, dados);
    
    revalidatePath("/motorista");
    return { sucesso: true };
  } catch (error) {
    return { sucesso: false, erro: errorToMessage(error, "Erro ao editar motorista.") };
  }
}

export async function deletarMotorista(id: number): Promise<RespostaAcao> {
  try {
    await deletarMotoristaService(id);
    
    revalidatePath("/motorista");
    return { sucesso: true };
  } catch (error) {
    return { sucesso: false, erro: errorToMessage(error, "Erro ao deletar motorista.") };
  }
}

function parseDataLocal(dataTexto: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dataTexto)) {
    throw new Error("Data inválida.")
  }

  const [anoTexto, mesTexto, diaTexto] = dataTexto.split("-")
  const ano = Number(anoTexto)
  const mes = Number(mesTexto)
  const dia = Number(diaTexto)
  const data = new Date(ano, mes - 1, dia)

  if (
    Number.isNaN(data.getTime()) ||
    data.getFullYear() !== ano ||
    data.getMonth() !== mes - 1 ||
    data.getDate() !== dia
  ) {
    throw new Error("Data inválida.")
  }

  return data
}

export async function atualizarJornadaMotoristaNoCalendario(
  idMotorista: number,
  dataReferencia: string,
  codigoNoDia: number,
): Promise<RespostaAcao> {
  try {
    if (!Number.isInteger(codigoNoDia) || codigoNoDia < 1 || codigoNoDia > 10) {
      return { sucesso: false, erro: "Código de jornada inválido." }
    }

    const data = parseDataLocal(dataReferencia)

    await registrarJornadaNoDiaService(idMotorista, data, codigoNoDia)
    revalidatePath("/motorista")
    return { sucesso: true }
  } catch (error) {
    return { sucesso: false, erro: errorToMessage(error, "Erro ao atualizar jornada no calendário.") }
  }
}