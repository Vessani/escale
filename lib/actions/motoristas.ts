'use server'
import { revalidatePath } from "next/cache";
import { NovoMotoristaInput, EditarMotoristaInput, type RespostaAcao } from "@/lib/types/types";
import { errorToMessage } from "@/lib/action-error";
import { 
  criarMotoristaService, 
  editarMotoristaService, 
  deletarMotoristaService,
  atualizarDiasTrabalhadosMotoristaService,
} from "@/lib/services/motorista.service";
import { calcularCodigoAtualPorCodigoNoDia } from "@/lib/services/jornada.service";

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
    const data = parseDataLocal(dataReferencia)
    const hoje = new Date()
    const codigoAtual = calcularCodigoAtualPorCodigoNoDia(codigoNoDia, data, hoje)

    if (!Number.isInteger(codigoAtual) || codigoAtual < 1 || codigoAtual > 10) {
      return { sucesso: false, erro: "Código de jornada inválido." }
    }

    await atualizarDiasTrabalhadosMotoristaService(idMotorista, codigoAtual)
    revalidatePath("/motorista")
    return { sucesso: true }
  } catch (error) {
    return { sucesso: false, erro: errorToMessage(error, "Erro ao atualizar jornada no calendário.") }
  }
}