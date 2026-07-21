'use server'
import { revalidatePath } from "next/cache";
import { NovoMotoristaInput, EditarMotoristaInput, type RespostaAcao } from "@/lib/types/types";
import { errorToMessage } from "@/lib/action-error";
import { requireSession } from "@/lib/auth-guard";
import { parseDataLocal } from "@/lib/utils/date-format";
import {
  criarMotoristaService,
  editarMotoristaService,
  deletarMotoristaService,
  registrarJornadaNoDiaService,
} from "@/lib/services/motorista.service";
import {
  atualizarJornadaRelatorioDosMotoristas,
  type ResultadoImportacaoJornada,
} from "@/lib/services/jornada-relatorio.service";
import type { RegistroJornadaRelatorio } from "@/lib/parsers/jornada-relatorio-parser";

export async function criarMotorista(dados: NovoMotoristaInput): Promise<RespostaAcao> {
  try {
    await requireSession();
    await criarMotoristaService(dados);
    
    revalidatePath("/motorista"); 
    return { sucesso: true };
  } catch (error) {
    return { sucesso: false, erro: errorToMessage(error, "Erro ao criar motorista.") };
  }
}

export async function editarMotorista(idMotorista: number, dados: EditarMotoristaInput): Promise<RespostaAcao> {
  try {
    await requireSession();
    await editarMotoristaService(idMotorista, dados);
    
    revalidatePath("/motorista");
    return { sucesso: true };
  } catch (error) {
    return { sucesso: false, erro: errorToMessage(error, "Erro ao editar motorista.") };
  }
}

export async function deletarMotorista(id: number): Promise<RespostaAcao> {
  try {
    await requireSession();
    await deletarMotoristaService(id);
    
    revalidatePath("/motorista");
    return { sucesso: true };
  } catch (error) {
    return { sucesso: false, erro: errorToMessage(error, "Erro ao deletar motorista.") };
  }
}

export async function atualizarJornadaMotoristaNoCalendario(
  idMotorista: number,
  dataReferencia: string,
  codigoNoDia: number,
): Promise<RespostaAcao> {
  try {
    await requireSession();

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

export type RespostaImportacaoJornada =
  | { sucesso: true; resultado: ResultadoImportacaoJornada }
  | { sucesso: false; erro: string }

/**
 * Importa o Relatório Sintético de Jornada (upload recorrente — ver
 * app/motorista/importar-jornada). Atualiza só o último registro de cada
 * motorista, por matrícula (`seva`) — ver jornada-relatorio.service.ts.
 */
export async function atualizarJornadaRelatorio(
  registros: RegistroJornadaRelatorio[],
): Promise<RespostaImportacaoJornada> {
  try {
    await requireSession();
    const resultado = await atualizarJornadaRelatorioDosMotoristas(registros);

    revalidatePath("/motorista");
    return { sucesso: true, resultado };
  } catch (error) {
    console.error("[atualizarJornadaRelatorio] Erro ao importar relatório de jornada:", error);
    return { sucesso: false, erro: errorToMessage(error, "Não foi possível importar o relatório de jornada.") };
  }
}