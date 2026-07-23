'use server'
import { revalidatePath } from "next/cache";
import { type RespostaAcao } from "@/lib/types/types";
import { errorToMessage } from "@/lib/action-error";
import { requireSession } from "@/lib/auth-guard";
import type { FrotaFormValues } from "@/lib/validation/frotas";
import {
  criarFrotaService,
  editarFrotaService,
  deletarFrotaService,
} from "@/lib/services/frota.service";

export async function criarFrota(dados: FrotaFormValues): Promise<RespostaAcao> {
  try {
    await requireSession();
    await criarFrotaService(dados);

    revalidatePath("/frotas");
    return { sucesso: true };
  } catch (error) {
    return { sucesso: false, erro: errorToMessage(error, "Erro ao criar conjunto.") };
  }
}

export async function editarFrota(id: number, dados: FrotaFormValues): Promise<RespostaAcao> {
  try {
    await requireSession();
    await editarFrotaService(id, dados);

    revalidatePath("/frotas");
    return { sucesso: true };
  } catch (error) {
    return { sucesso: false, erro: errorToMessage(error, "Erro ao editar conjunto.") };
  }
}

export async function deletarFrota(id: number): Promise<RespostaAcao> {
  try {
    await requireSession();
    await deletarFrotaService(id);

    revalidatePath("/frotas");
    return { sucesso: true };
  } catch (error) {
    return { sucesso: false, erro: errorToMessage(error, "Erro ao deletar conjunto.") };
  }
}
